#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  EN-CHECK — SIMULATEUR DE POINTEUSE ZKTECO (mode ADMS)
//  Livraison 33 · fichier : adms/simulateur-pointeuse.js
//
//  À QUOI ÇA SERT
//  ───────────────────────────────────────────────────────────────────────────
//  Tu n'as pas besoin d'une vraie pointeuse sous la main pour vérifier que tout
//  fonctionne : ce programme JOUE une ZKTeco. Il fait exactement ce que fait la
//  machine, dans le même ordre, avec le même format :
//
//      ① « bonjour, donne-moi mes réglages »   GET  /iclock/cdata?SN=…&options=all
//      ② « quelque chose à faire ? »           GET  /iclock/getrequest?SN=…
//      ③ « voici mes pointages »               POST /iclock/cdata?SN=…&table=ATTLOG
//
//  Si ça marche avec lui, alors ce qui reste à vérifier sur le terrain n'est
//  plus le serveur — c'est seulement le firmware de la machine.
//
//  ───────────────────────────────────────────────────────────────────────────
//  COMMENT S'EN SERVIR
//  ───────────────────────────────────────────────────────────────────────────
//      node adms/simulateur-pointeuse.js --serveur http://localhost:8080 --sn TEST-1
//
//  Options :
//      --serveur   adresse du receveur (défaut http://localhost:8080)
//      --sn        numéro de série de la pointeuse simulée (défaut TEST-1)
//      --pins      liste de PIN séparés par des virgules (défaut « 0001,0002 »)
//      --par-pin   nombre de pointages par PIN (défaut 4)
//      --mode      normal | reconnexion | double | inconnu   (défaut normal)
//      --jours     en mode reconnexion : combien de jours d'arriéré (défaut 3)
//
//  Les quatre modes, et ce qu'ils prouvent :
//      normal       le parcours ordinaire
//      reconnexion  la pointeuse a été coupée plusieurs jours : elle renvoie
//                   TOUT son arriéré d'un coup — c'est le cas normal en
//                   Afrique de l'Ouest, et le serveur doit l'accepter
//      double       elle renvoie DEUX FOIS le même lot : rien ne doit être
//                   compté en double (c'est le cœur qui filtre, pas le receveur)
//      inconnu      des PIN qui ne correspondent à aucun employé : ils doivent
//                   être signalés NOMMÉMENT, pas perdus en silence
//
//  Sans dépendance : Node 18 ou plus.
// ════════════════════════════════════════════════════════════════════════════

'use strict';

// ─── Les options ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function option(nom, defaut) {
  const i = args.indexOf('--' + nom);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : defaut;
}

const serveur = option('serveur', 'http://localhost:8080').replace(/\/+$/, '');
const serial  = option('sn', 'TEST-1').toUpperCase();
const pins    = option('pins', '0001,0002').split(',').map((s) => s.trim()).filter(Boolean);
const parPin  = Math.max(1, Number(option('par-pin', 4)));
const mode    = option('mode', 'normal');
const jours   = Math.max(1, Number(option('jours', 3)));

// ─── L'affichage : on veut un échange LISIBLE, c'est un outil de terrain ────
const titre = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const vers  = (t) => console.log(`\x1b[36m→ ${t}\x1b[0m`);
const de    = (t) => console.log(`\x1b[32m← ${t}\x1b[0m`);
const alerte = (t) => console.log(`\x1b[33m⚠️  ${t}\x1b[0m`);
const erreur = (t) => console.log(`\x1b[31m🔴 ${t}\x1b[0m`);

function deuxChiffres(n) { return String(n).padStart(2, '0'); }
function horodatage(d) {
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())} ` +
         `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}:${deuxChiffres(d.getSeconds())}`;
}

// ─── Les échanges avec le receveur ──────────────────────────────────────────
async function appeler(chemin, options = {}) {
  const url = `${serveur}${chemin}`;
  let reponse;
  try {
    reponse = await fetch(url, options);
  } catch (e) {
    erreur(`impossible de joindre ${serveur} — le receveur est-il démarré ? (${e.message})`);
    process.exit(1);
  }
  const texte = await reponse.text();
  return { statut: reponse.status, texte };
}

// ─── La fabrication des pointages, comme une vraie machine ─────────────────
//  Une ligne ATTLOG =  PIN <TAB> date <TAB> status <TAB> verify <TAB> workcode
//  status : 0 = entrée, 1 = sortie (c'est ce que la machine écrit).
function fabriquerLot({ reculerJours = 0, pinsUtilises = pins } = {}) {
  const lignes = [];
  const maintenant = new Date();
  for (const pin of pinsUtilises) {
    for (let i = 0; i < parPin; i++) {
      const jour = new Date(maintenant);
      jour.setDate(jour.getDate() - reculerJours - Math.floor(i / 2));
      const entree = i % 2 === 0;
      jour.setHours(entree ? 7 + Math.floor(i / 2) : 12 + Math.floor(i / 2), (i * 7) % 60, (i * 13) % 60);
      lignes.push(
        [pin, horodatage(jour), String(entree ? 0 : 1), '1', '0'].join('\t')
      );
    }
  }
  return lignes;
}

async function envoyerLot(lignes, etape) {
  const corps = lignes.join('\n');
  vers(`POST /iclock/cdata?SN=${serial}&table=ATTLOG&Stamp=9999   (${lignes.length} ligne(s))`);
  console.log('   ┌─ ce que la pointeuse envoie (extrait) ' + '─'.repeat(34));
  for (const l of lignes.slice(0, 3)) console.log('   │ ' + l.replace(/\t/g, '  →  '));
  if (lignes.length > 3) console.log(`   │ … ${lignes.length - 3} autre(s) ligne(s)`);
  console.log('   └' + '─'.repeat(70));

  const debut = Date.now();
  const r = await appeler(`/iclock/cdata?SN=${encodeURIComponent(serial)}&table=ATTLOG&Stamp=9999`, {
    method: 'POST',
    headers: { 'content-type': 'plain/text' },
    body: corps
  });
  const ms = Date.now() - debut;
  if (r.statut === 200) {
    de(`réponse du receveur : « ${r.texte.trim()} »   (${ms} ms)   — ${etape}`);
  } else {
    erreur(`le receveur a répondu ${r.statut} : « ${r.texte.trim()} »`);
  }
  return r;
}

// ─── Le déroulé ─────────────────────────────────────────────────────────────
(async () => {
  titre(`═══ SIMULATEUR ZKTECO — pointeuse « ${serial} » ═══`);
  console.log(`receveur : ${serveur}`);
  console.log(`mode     : ${mode}` + (mode === 'reconnexion' ? ` (${jours} jour(s) d'arriéré)` : ''));

  // ① LE BONJOUR
  titre('① La pointeuse se présente (comme au démarrage)');
  vers(`GET /iclock/cdata?SN=${serial}&options=all`);
  const bonjour = await appeler(`/iclock/cdata?SN=${encodeURIComponent(serial)}&options=all`);
  if (bonjour.statut !== 200) {
    erreur(`le receveur a répondu ${bonjour.statut} au « bonjour » — c'est anormal.`);
  } else {
    de('voici les réglages reçus :');
    for (const l of bonjour.texte.trim().split(/\r?\n/)) console.log('   │ ' + l);
    if (!bonjour.texte.includes('GET OPTION FROM')) {
      alerte('le bloc ne contient pas « GET OPTION FROM » — une vraie pointeuse risque de refuser.');
    }
  }

  // ② LE BATTEMENT
  titre('② La pointeuse demande s\'il y a du travail (toutes les ~30 s)');
  vers(`GET /iclock/getrequest?SN=${serial}`);
  const battement = await appeler(`/iclock/getrequest?SN=${encodeURIComponent(serial)}`);
  de(`réponse : « ${battement.texte.trim()} »  — c'est ce que la machine attend`);

  // ③ L'ENVOI
  if (mode === 'inconnu') {
    titre('③ Envoi avec des PIN qui ne correspondent à aucun employé');
    console.log('   (on ajoute deux PIN fantômes — ils doivent être signalés nommément)');
    const lot = fabriquerLot({ pinsUtilises: [...pins, '99001', '99002'] });
    await envoyerLot(lot, 'lot mêlant PIN connus et inconnus');
    console.log('\n   ↳ Regarde le journal du receveur : il doit citer « PIN inconnus » avec 99001 et 99002.');
  } else if (mode === 'reconnexion') {
    titre(`③ La pointeuse revient après une panne réseau (${jours} jour(s) d'arriéré)`);
    console.log('   C\'est le cas NORMAL : la machine garde tout en mémoire et renvoie d\'un coup.');
    const lot = fabriquerLot({ reculerJours: jours });
    await envoyerLot(lot, 'arriéré complet renvoyé d\'un seul coup');
    console.log('\n   ↳ Le receveur ne coupe PAS un lot un peu gros : c\'est le cœur qui décide.');
  } else if (mode === 'double') {
    titre('③ La pointeuse renvoie DEUX FOIS le même lot');
    const lot = fabriquerLot({ reculerJours: 1 });
    await envoyerLot(lot, 'premier envoi');
    console.log('\n   (la machine n\'a pas eu la confirmation : elle recommence)');
    await envoyerLot(lot, 'second envoi — IDENTIQUE');
    console.log('\n   ↳ Le journal doit montrer « doublons » > 0 au second envoi, et ZÉRO ligne ajoutée.');
  } else {
    titre('③ La pointeuse envoie ses pointages');
    const lot = fabriquerLot();
    await envoyerLot(lot, 'envoi ordinaire');
  }

  titre('═══ FIN ═══');
  console.log('Ouvre la page du receveur pour voir son état : ' + serveur + '/');
  console.log('Et dans l\'application : page « Pointages » — les lignes doivent y être.');
})();
