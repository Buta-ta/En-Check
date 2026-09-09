#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  EN-CHECK — RECEVEUR ADMS (les pointeuses ZKTeco en réseau)
//  fichier : receveur.js
//
//  CE QUE C'EST
//  ───────────────────────────────────────────────────────────────────────────
//  Un petit serveur HTTP qui répond à une pointeuse ZKTeco configurée en mode
//  « Cloud Server / ADMS ». La pointeuse INITIE la connexion : aucune adresse
//  publique n'est nécessaire côté client, aucune redirection de port — elle
//  traverse la NAT toute seule, même derrière un routeur 4G.
//
//  CE QU'IL FAIT, EXACTEMENT :
//      ① il écoute trois adresses que la pointeuse appelle :
//            GET  /iclock/cdata?SN=…&options=all   → les réglages (« bonjour »)
//            GET  /iclock/getrequest?SN=…          → « quelque chose à faire ? »
//            POST /iclock/cdata?SN=…&table=ATTLOG  → les pointages
//      ② il décide RIEN : il transmet au serveur En-Check
//         (`encheck_adms_ingest`), qui rattache les PIN aux matricules, convertit
//         l'heure murale avec le fuseau de l'entreprise, et applique les règles
//         métier (doublons, sens, heures aberrantes) — LE MÊME CŒUR que l'import
//         USB et l'app mobile ;
//      ③ il répond ce que la pointeuse attend, et journalise tout ;
//      ④ TOUTES LES 15 MINUTES, il demande au serveur En-Check de passer les
//         entreprises en revue : pointeuse qui ne parle plus, badge inconnu,
//         sortie manquante, absence inhabituelle. Les alertes rouges et orange
//         partent alors sur les téléphones — même la nuit, même le week-end,
//         même si personne n'a ouvert le tableau de bord.
//
//  ══════════════════════════════════════════════════════════════════════════
//  LE BOÎTIER HORS-LIGNE — ce que ce fichier garantit quand le réseau tombe
//  ══════════════════════════════════════════════════════════════════════════
//  La connexion du client tombe — c'est le cas normal, pas l'exception. Voici ce
//  qui se passe, dans l'ordre :
//
//      · le réseau répond      → le lot part directement au serveur En-Check
//                                (le chemin ordinaire, inchangé) ;
//      · le réseau ne répond pas → le lot est ÉCRIT SUR LE DISQUE du boîtier, et
//                                la pointeuse reçoit « OK » : elle libère sa
//                                mémoire et continue de pointer normalement ;
//      · le réseau revient     → la file se vide toute seule, du plus ancien au
//                                plus récent, sans que personne ne touche à rien.
//
//  Rien n'est jamais perdu, rien n'est jamais compté deux fois : le serveur
//  reconnaît les doublons, donc une remontée qui repart deux fois ne crée pas
//  deux pointages.
//
//  LA FILE EST UN FICHIER LISIBLE : `file-dattente.jsonl`, à côté de ce
//  programme — une ligne par lot, avec l'heure de réception. Tant qu'il contient
//  des lignes, c'est qu'il reste des pointages à remonter. On peut l'ouvrir avec
//  n'importe quel éditeur de texte pour compter ce qui attend.
//
//  ⚠️ Pendant une coupure, ce fichier est LA seule copie de ces pointages : ne le
//     supprime pas, ne le déplace pas, et fais une copie de sauvegarde si la
//     coupure dure plusieurs jours.
//
//  C'EST UN FICHIER UNIQUE, SANS AUCUNE DÉPENDANCE : pas de `npm install`.
//  Node 18 ou plus suffit (il fournit `fetch`).
//
//  ───────────────────────────────────────────────────────────────────────────
//  COMMENT LE LANCER
//  ───────────────────────────────────────────────────────────────────────────
//  1) Copie `config.exemple.json` en `config.json` et remplis-le :
//
//        {
//          "supabase_url": "https://xxxxxxxx.supabase.co",
//          "supabase_key": "la clé publique (anon) du projet",
//          "port": 8080,
//          "journal": "pointages.log"
//        }
//
//     ⚠️ `supabase_key` = la clé PUBLIQUE (anon). Surtout PAS la clé service.
//        C'est le SECRET DE L'APPAREIL qui protège, et il vit dans
//        `appareils.json` (ci-dessous) — jamais dans la pointeuse.
//
//  2) Copie `appareils.exemple.json` en `appareils.json`, puis enregistre chaque
//     pointeuse dans l'application et recopie son secret :
//
//        [
//          { "serial": "AANF123456789", "secret": "le-secret-du-registre",
//            "label": "Pointeuse entrée dépôt" }
//        ]
//
//  3) Démarre :
//
//        node receveur.js
//
//     puis, pour vérifier depuis un navigateur :
//        http://localhost:8080/          → page de contrôle « je suis vivant »
//
//  4) Côté pointeuse : Menu → Comm → Cloud Server Setting
//        Enable        = YES
//        Server Address= l'adresse de cette machine (IP ou nom de domaine)
//        Server Port   = le port ci-dessus (80 si tu utilises un sous-domaine)
//     Puis « Test » : la pointeuse doit afficher « Connected ».
//
//  ───────────────────────────────────────────────────────────────────────────
//  LA PAGE DE CONTRÔLE (ouvre-la depuis le site, même sans Internet)
//  ───────────────────────────────────────────────────────────────────────────
//        http://<adresse-du-boîtier>:8080/
//     Elle dit : en service ou hors ligne, combien de lots attendent, depuis
//     quand, quand la dernière remontée a réussi. Pour forcer une remontée tout
//     de suite :  http://<adresse-du-boîtier>:8080/?forcer=1
//
//  ───────────────────────────────────────────────────────────────────────────
//  SI QUELQUE CHOSE NE VA PAS
//  ───────────────────────────────────────────────────────────────────────────
//  · La pointeuse affiche « Connect Failed »  → l'adresse ou le port sont faux,
//    ou le boîtier n'est pas sur le même réseau que la pointeuse.
//  · La pointeuse affiche « Connected » mais rien n'arrive → le numéro de série
//    n'est pas dans `appareils.json`, ou son secret ne correspond pas à celui
//    enregistré dans l'application. Le journal le dit noir sur blanc.
//  · `pointages.log` dit « serveur injoignable » toutes les 30 secondes → la
//    connexion du site est tombée. Les pointages s'empilent dans
//    `file-dattente.jsonl` et remonteront tout seuls. Rien à faire.
// ════════════════════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');

const ICI = __dirname;

function lireJson(nom, defaut) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ICI, nom), 'utf8'));
  } catch (e) {
    return defaut;
  }
}

const config = Object.assign(
  {
    supabase_url: '',
    supabase_key: '',
    port: Number(process.env.PORT || '8080'),
    // Combien de secondes la pointeuse attend entre deux « quelque chose à
    // faire ? ». 5 s = réglage d'usine ZKTeco. Mets une valeur plus grande (60)
    // si tu veux moins de trafic.
    delai_secondes: 5,
    // La pointeuse pousse ses pointages dès qu'elle en a un (1) ou par lots (0).
    realtime: 1,
    // Le journal sur disque : chaque ligne horodatée, pour comprendre après coup.
    journal: 'pointages.log',
    // ── Les réglages du boîtier hors-ligne ────────────────────────────────
    // Le fichier qui garde les pointages pendant une coupure de réseau.
    file_attente: 'file-dattente.jsonl',
    // Toutes les combien de secondes on essaie de vider la file.
    remontee_secondes: 30,
    // Au-delà de ce temps, on considère qu'une tentative de joindre En-Check a
    // échoué : on range le lot de côté plutôt que de faire attendre la pointeuse.
    delai_reseau_ms: 8000,
    // Balayage des anomalies (voir plus bas). 0 = désactivé. En secondes.
    // Mets une valeur plus grande (60) si tu veux moins de trafic.
    balayage_minutes: Number(process.env.BALAYAGE_MINUTES || '15'),
    // Jeton de curiosité : si tu mets une valeur, l'adresse `/` la demandera.
    // Utile si ton receveur est exposé sur Internet.
    cle_page: process.env.PAGE_KEY || ''
  },
  lireJson('config.json', {})
);

const appareils = lireJson('appareils.json', []);
const parSerial = new Map(
  (Array.isArray(appareils) ? appareils : []).map((a) => [
    String(a.serial || '').trim().toUpperCase(),
    a
  ])
);

// ─── Le journal (console + fichier, pour dépanner sur le terrain) ────────────
function journaliser(ligne) {
  const horodatage = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const texte = `${horodatage}  ${ligne}`;
  console.log(texte);
  if (config.journal) {
    try {
      fs.appendFileSync(path.join(ICI, config.journal), texte + '\n');
    } catch (e) {
      /* le journal ne doit JAMAIS faire tomber le service */
    }
  }
}

// ─── Le délai d'attente sur le réseau ───────────────────────────────────────
//  Sans ça, une tentative vers un serveur injoignable peut rester en suspens
//  longtemps — et la pointeuse, elle, attend la réponse. On plafonne.
function signalDeDelai(ms) {
  try {
    return AbortSignal.timeout(ms);
  } catch (e) {
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  }
}

// ─── L'appel au serveur En-Check (Supabase) ─────────────────────────────────
async function appelerServeur(fonction, corps) {
  if (!config.supabase_url || !config.supabase_key) {
    throw new Error('supabase_url / supabase_key absents de config.json');
  }
  const url = `${config.supabase_url.replace(/\/+$/, '')}/rest/v1/rpc/${fonction}`;
  const reponse = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: config.supabase_key,
      authorization: `Bearer ${config.supabase_key}`
    },
    body: JSON.stringify(corps),
    signal: signalDeDelai(config.delai_reseau_ms)
  });
  const texte = await reponse.text();
  if (!reponse.ok) {
    throw new Error(`${reponse.status} ${texte.slice(0, 300)}`);
  }
  try {
    return JSON.parse(texte);
  } catch (e) {
    return { brut: texte };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  LA FILE D'ATTENTE — les pointages gardés au chaud pendant une coupure
// ════════════════════════════════════════════════════════════════════════════
//  Un fichier, une ligne par LOT reçu d'une pointeuse. La file se vide dans
//  l'ordre : le plus ancien part le premier, sinon deux lots du même employé
//  pourraient arriver à l'envers et brouiller le sens entrée/sortie.
// ════════════════════════════════════════════════════════════════════════════

const CHEMIN_FILE = path.join(ICI, config.file_attente || 'file-dattente.jsonl');

let attente = [];            // les lots qui n'ont pas encore atteint En-Check
let lignesIllisibles = 0;    // ce qu'on n'a pas su relire au démarrage
let enRemontee = false;      // deux remontées en même temps ; on n'en veut pas
let dernierSucces = null;    // dernier échange réussi avec En-Check
let dernierPunch = null;     // { serial, quand } — la dernière pointeuse entendue
let demarrage = new Date();

function chargerLaFile() {
  attente = [];
  lignesIllisibles = 0;
  let brut = '';
  try {
    brut = fs.readFileSync(CHEMIN_FILE, 'utf8');
  } catch (e) {
    return;   // pas de fichier : c'est le cas normal au premier démarrage
  }
  for (const ligne of brut.split('\n')) {
    if (!ligne.trim()) continue;
    try {
      const e = JSON.parse(ligne);
      if (e && e.serial && Array.isArray(e.pointages) && e.pointages.length) attente.push(e);
      else lignesIllisibles += 1;
    } catch (err) {
      lignesIllisibles += 1;
    }
  }
}

//  Écrit la file sur le disque, en une seule opération : on écrit un fichier
//  neuf à côté, puis on le met à la place de l'ancien. Si le courant est coupé
//  au mauvais moment, l'ancien fichier est intact — jamais de file à moitié.
function ecrireLaFile() {
  let texte = '';
  for (const e of attente) texte += JSON.stringify(e) + '\n';
  const provisoire = CHEMIN_FILE + '.tmp';
  try {
    fs.writeFileSync(provisoire, texte, 'utf8');
    fs.renameSync(provisoire, CHEMIN_FILE);
    return true;
  } catch (e) {
    journaliser(`⚠️ impossible d'écrire la file d'attente (${e.message}) — on réessaiera`);
    return false;
  }
}

function mettreEnAttente(entree) {
  attente.push(entree);
  try {
    fs.appendFileSync(CHEMIN_FILE, JSON.stringify(entree) + '\n', 'utf8');
  } catch (e) {
    journaliser(`🔴 la file d'attente n'a pas pu être écrite (${e.message}) — le lot reste en mémoire`);
    //  Le lot reste en mémoire : s'il n'y a pas de redémarrage, il repartira
    //  quand même. On le dit très fort, c'est le seul cas où on frôle la perte.
    ecrireLaFile();
  }
  if (attente.length === 5000 || attente.length === 20000) {
    journaliser(
      `⚠️ ${attente.length} lots en attente — la connexion du site est coupée depuis longtemps. ` +
        'La file grossit d\'environ 1 Ko par jour et par employé : ce n\'est pas grave, mais garde une copie du fichier.'
    );
  }
}

//  Vide la file, du plus ancien au plus récent. S'arrête à la première panne :
//  inutile d'insister, le réseau est encore tombé, on réessaiera au tour suivant.
async function remonterLaFile(motif = 'périodique') {
  if (enRemontee) return { envoyes: 0, restants: attente.length, occupe: true };
  if (attente.length === 0) return { envoyes: 0, restants: 0 };
  if (!config.supabase_url || !config.supabase_key) return { envoyes: 0, restants: attente.length };

  enRemontee = true;
  let envoyes = 0;
  let pointagesEnvoyes = 0;
  journaliser(`⟳ remontée ${motif} : ${attente.length} lot(s) en attente`);
  try {
    while (attente.length > 0) {
      const entree = attente[0];
      let resultat;
      try {
        resultat = await appelerServeur('encheck_adms_ingest', {
          p_serial: entree.serial,
          p_secret: entree.secret,
          p_punches: entree.pointages,
          p_dry_run: false
        });
      } catch (e) {
        journaliser(
          `⟳ remontée : toujours injoignable (${e.message}) — ` +
            `${attente.length} lot(s) gardé(s) de côté, on réessaiera`
        );
        break;
      }
      dernierSucces = new Date();
      envoyes += 1;
      pointagesEnvoyes += entree.pointages.length;
      const refus = resultat && resultat.ok === false;
      journaliser(
        `⟳ remontée : ${entree.serial} — ${entree.pointages.length} pointage(s) ` +
          (refus ? `⚠️ refusés par le serveur (${resultat.reason || '?'})` : '🟢 enregistrés') +
          (entree.recu_le ? ` — reçus le ${entree.recu_le.replace('T', ' ').slice(0, 16)}` : '')
      );
      attente = attente.slice(1);   //  sorti de la file SEULEMENT une fois arrivé
    }
  } finally {
    if (envoyes > 0) ecrireLaFile();
    enRemontee = false;
  }
  if (envoyes > 0) {
    journaliser(
      `⟳ remontée terminée : ${envoyes} lot(s), ${pointagesEnvoyes} pointage(s) — ` +
        `reste ${attente.length} en attente`
    );
  }
  return { envoyes, restants: attente.length };
}

//  Combien de pointages attendent, et depuis quand.
function etatDeLaFile() {
  let pointages = 0;
  for (const e of attente) pointages += e.pointages.length;
  const plusAncien = attente.length ? attente[0].recu_le || null : null;
  return { lots: attente.length, pointages, plusAncien };
}

// ─── Le balayage des anomalies (toutes les 15 minutes) ───────────────────────
//     Le serveur s'annonce avec le numéro de série et le secret de chaque
//     appareil : il ne peut donc balayer que les entreprises de SES pointeuses.
//     Aucun droit supplémentaire n'est donné, et rien ici ne peut faire tomber
//     le service : tout échec est journalisé, jamais propagé.
let balayageEnCours = false;

async function balayerLesAnomalies() {
  if (balayageEnCours) {
    journaliser("⟳ balayage : le précédent n'est pas terminé, on saute ce tour");
    return;
  }
  if (parSerial.size === 0) return;
  if (!config.supabase_url || !config.supabase_key) return;

  balayageEnCours = true;
  let injoignable = 0;
  const entreprisesVues = new Set();
  try {
    for (const [serial, appareil] of parSerial) {
      if (!appareil.secret) continue;
      try {
        const r = await appelerServeur('encheck_adms_balayage', {
          p_serial: serial,
          p_secret: appareil.secret
        });
        if (!r || r.ok === false) {
          journaliser(`⟳ balayage ${serial} : refusé (${(r && r.reason) || 'réponse inattendue'})`);
          continue;
        }
        const ent = r.enterprise_id ? String(r.enterprise_id) : '';
        if (ent && entreprisesVues.has(ent)) continue;   // une seule fois par entreprise
        if (ent) entreprisesVues.add(ent);
        const creees = Number(r.alertes_creees || 0);
        const poussees = Number(r.alertes_poussees || 0);
        journaliser(
          `⟳ balayage ${serial} : ${creees} alerte(s) nouvelle(s), ` +
          `${poussees} portée(s) sur les téléphones`
        );
      } catch (e) {
        injoignable += 1;
        journaliser(`⟳ balayage ${serial} : ⚠️ serveur injoignable (${e.message}) — on réessaiera`);
      }
    }
  } finally {
    balayageEnCours = false;
    //  Une seule ligne quand tout le monde est injoignable : pendant une coupure,
    //  on ne veut pas noyer le journal.
    if (injoignable > 1) {
      journaliser(`⟳ balayage : ${injoignable} appareils n'ont pas pu joindre En-Check — connexion du site coupée`);
    }
  }
}

// ─── Lecture du corps de la requête (bornée : une pointeuse ne doit pas
//     pouvoir remplir la mémoire du serveur) ─────────────────────────────────
const TAILLE_MAX = 4 * 1024 * 1024; // 4 Mo

function lireCorps(req) {
  return new Promise((resolve, reject) => {
    let taille = 0;
    const morceaux = [];
    req.on('data', (m) => {
      taille += m.length;
      if (taille > TAILLE_MAX) {
        reject(new Error('corps trop volumineux'));
        req.destroy();
        return;
      }
      morceaux.push(m);
    });
    req.on('end', () => resolve(Buffer.concat(morceaux).toString('utf8')));
    req.on('error', reject);
  });
}

// ─── Le décodage d'une ligne de pointage ────────────────────────────────────
//  Format ZKTeco (ATTLOG), séparé par des TABULATIONS — parfois des espaces
//  selon les firmwares :
//      PIN  <TAB>  2026-09-28 08:12:03  <TAB>  status  <TAB>  verify  <TAB>  workcode
//  On ne CONVERTIT RIEN ici : l'heure part telle quelle, et c'est le serveur qui
//  l'interprète avec le fuseau de l'entreprise (c'est là qu'est la vérité).
function decouperLigne(ligne) {
  const morceaux = ligne.includes('\t') ? ligne.split('\t') : ligne.trim().split(/\s+/);
  const pin = (morceaux[0] || '').trim();
  if (!pin) return null;

  // La date est tantôt « 2026-09-28 08:12:03 » (deux morceaux), tantôt un seul.
  let datetime = (morceaux[1] || '').trim();
  let reste = morceaux.slice(2);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datetime) && reste[0] && /^\d{2}:\d{2}:\d{2}$/.test(reste[0].trim())) {
    datetime = `${datetime} ${reste[0].trim()}`;
    reste = reste.slice(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(datetime)) return null;

  return {
    pin,
    datetime: datetime.replace('T', ' '),
    status: (reste[0] || '').trim(),
    verify: (reste[1] || '').trim(),
    workcode: (reste[2] || '').trim()
  };
}

function analyserAttlog(corps) {
  const lignes = corps.split(/\r?\n/);
  const pointages = [];
  let ignorees = 0;
  for (const ligne of lignes) {
    if (!ligne.trim()) continue;
    const p = decouperLigne(ligne);
    if (p) pointages.push(p);
    else ignorees += 1;
  }
  return { pointages, ignorees };
}

// ─── La réponse de configuration attendue par la pointeuse ──────────────────
//  ZKTeco est pointilleux sur ce bloc. Les valeurs sont des constantes
//  modifiables en haut du fichier si un firmware réclame autre chose.
function blocConfiguration(serial) {
  return [
    `GET OPTION FROM: ${serial}`,
    `Stamp=9999`,
    `ErrorDelay=30`,
    `Delay=${config.delai_secondes}`,
    `TransTimes=00:00;14:05`,
    `TransInterval=1`,
    `TransFlag=1111000000`,
    `TimeZone=0`,
    `Realtime=${config.realtime}`,
    `Encrypt=0`,
    `OK`
  ].join('\r\n') + '\r\n';
}

// ─── Le traitement d'une requête ────────────────────────────────────────────
const serveur = http.createServer(async (req, rep) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const chemin = url.pathname.replace(/\/+$/, '') || '/';
  const params = url.searchParams;
  const serial = (params.get('SN') || params.get('sn') || '').trim().toUpperCase();
  const table = (params.get('table') || '').trim().toUpperCase();

  const envoyer = (code, texte, type = 'text/plain; charset=utf-8') => {
    rep.writeHead(code, { 'content-type': type, 'content-length': Buffer.byteLength(texte) });
    rep.end(texte);
  };

  try {
    // ── La page de contrôle (on l'ouvre dans un navigateur depuis le terrain) ──
    if (chemin === '/' || chemin === '/etat') {
      if (config.cle_page && params.get('cle') !== config.cle_page) {
        return envoyer(403, 'Accès refusé.');
      }

      //  Forcer une remontée tout de suite : utile quand on vient de rétablir la
      //  connexion et qu'on ne veut pas attendre le tour suivant.
      let forçage = '';
      if (params.get('forcer') === '1') {
        const r = await remonterLaFile('demandée depuis la page de contrôle');
        forçage = r.occupe
          ? `\nforçage : une remontée était déjà en cours`
          : `\nforçage : ${r.envoyes} lot(s) remonté(s) — reste ${r.restants} en attente`;
      }

      const f = etatDeLaFile();
      const ilYAMin = (d) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : null);
      const ageSucces = ilYAMin(dernierSucces);
      const horsLigne = !dernierSucces || ageSucces > 5;
      const agePunch = ilYAMin(dernierPunch && dernierPunch.quand);
      const enServiceDepuis = Math.round((Date.now() - demarrage.getTime()) / 60000);

      const lignes = [
        'En-Check — receveur des pointeuses',
        '',
        `état : ${horsLigne ? '⚠️ HORS LIGNE — les pointages attendent sur ce boîtier' : 'EN SERVICE'}`,
        `heure du boîtier : ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
        `allumé depuis : ${enServiceDepuis} minute(s)`,
        '',
        `pointages en attente : ${f.pointages}  (dans ${f.lots} lot(s))`,
        f.plusAncien
          ? `   · le plus ancien attend depuis ${ilYAMin(f.plusAncien)} minute(s), reçu le ${String(f.plusAncien).replace('T', ' ').slice(0, 16)}`
          : '   · rien en attente : tout est remonté',
        `dernière remontée réussie : ${dernierSucces ? `${String(dernierSucces.toISOString()).replace('T', ' ').slice(0, 19)}  (il y a ${ageSucces} minute(s))` : 'aucune pour l\'instant'}`,
        `dernière pointeuse entendue : ${dernierPunch ? `${dernierPunch.serial} — il y a ${agePunch} minute(s)` : 'aucune pour l\'instant'}`,
        '',
        `appareils connus : ${parSerial.size}`,
        ...(parSerial.size
          ? [...parSerial.entries()].map(([sn, a]) => `   · ${sn}${a.label ? ' — ' + a.label : ''}`)
          : ['   (aucun : renseigne appareils.json)']),
        '',
        `serveur En-Check : ${config.supabase_url || '⚠️ NON CONFIGURÉ'}`,
        `file d'attente : ${CHEMIN_FILE}`,
        `journal : ${path.join(ICI, config.journal || 'pointages.log')}`,
        lignesIllisibles ? `⚠️ ${lignesIllisibles} ligne(s) de la file n'ont pas pu être relues au démarrage` : '',
        forçage,
        '',
        'pour forcer une remontée maintenant : ajoute  ?forcer=1  à cette adresse'
      ].filter((l) => l !== '');

      return envoyer(200, lignes.join('\n'));
    }

    // ── ① LE « BONJOUR » DE LA POINTEUSE ────────────────────────────────────
    //   GET /iclock/cdata?SN=…&options=all   (ou sans options)
    if (chemin === '/iclock/cdata' && req.method === 'GET') {
      if (!serial) return envoyer(200, 'OK');
      const connu = parSerial.has(serial);
      journaliser(`⟵ ${serial} : bonjour${params.get('options') ? ' (options=' + params.get('options') + ')' : ''}${connu ? '' : '  ⚠️ APPAREIL NON ENREGISTRÉ'}`);
      if (!connu) {
        // On répond quand même « OK » : une pointeuse qui reçoit une erreur
        // réessaie en boucle et sature le réseau du client. On crie dans le
        // journal, et on laisse l'administrateur enregistrer l'appareil.
        journaliser(`   ↳ refusé en douceur : ajoute ${serial} dans appareils.json (et enregistre-le dans l'application)`);
      }
      return envoyer(200, blocConfiguration(serial));
    }

    // ── ② LE BATTEMENT DE CŒUR : « quelque chose à faire ? » ────────────────
    if (chemin === '/iclock/getrequest' || chemin === '/iclock/ping') {
      if (serial && parSerial.has(serial)) {
        dernierPunch = dernierPunch || null;
        // on prévient le serveur que l'appareil est vivant — sans bloquer la
        // réponse si le réseau est lent : la pointeuse ne doit PAS attendre.
        appelerServeur('encheck_adms_battement', { p_serial: serial }).catch(() => {});
      }
      // Pas de commande à pousser : la réponse attendue est simplement « OK ».
      return envoyer(200, 'OK');
    }

    // ── ③ L'ENVOI DES POINTAGES ─────────────────────────────────────────────
    if (chemin === '/iclock/cdata' && req.method === 'POST') {
      const corps = await lireCorps(req);

      if (!serial) {
        journaliser('⚠️ envoi sans numéro de série — ignoré');
        return envoyer(200, 'OK: 0');
      }

      const appareil = parSerial.get(serial);
      if (!appareil) {
        journaliser(`⟵ ${serial} : envoi REFUSÉ (appareil non enregistré) — ${corps.split(/\r?\n/).filter(Boolean).length} ligne(s) ignorée(s)`);
        return envoyer(200, 'OK: 0');
      }

      // Les tables que la pointeuse peut pousser. On n'en traite qu'une ; les
      // autres sont accusées poliment pour qu'elle ne les renvoie pas sans fin.
      if (table && table !== 'ATTLOG') {
        const n = corps.split(/\r?\n/).filter(Boolean).length;
        journaliser(`⟵ ${serial} : ${table} reçu (${n} ligne(s)) — ignoré volontairement (En-Check ne réclame que les pointages)`);
        return envoyer(200, `OK: ${n}`);
      }

      const { pointages, ignorees } = analyserAttlog(corps);
      if (ignorees > 0) {
        journaliser(`   ⚠️ ${ignorees} ligne(s) illisible(s) écartée(s) dans l'envoi`);
      }
      if (pointages.length === 0) {
        return envoyer(200, 'OK: 0');
      }

      dernierPunch = { serial, quand: new Date() };

      let resultat;
      try {
        resultat = await appelerServeur('encheck_adms_ingest', {
          p_serial: serial,
          p_secret: appareil.secret,
          p_punches: pointages,
          p_dry_run: false
        });
        dernierSucces = new Date();
      } catch (e) {
        // ══ LA COUPURE ══════════════════════════════════════════════════════
        //  Le réseau du client est tombé (ou la 4G rame). On ne perd RIEN :
        //   ① le lot est écrit sur le disque du boîtier ;
        //   ② la pointeuse reçoit « OK » — elle libère sa mémoire et continue de
        //      pointer normalement, semaine après semaine s'il le faut ;
        //   ③ la remontée repart toute seule au retour de la connexion.
        //  L'ordre est important : on écrit d'abord, on répond ensuite.
        mettreEnAttente({
          serial,
          secret: appareil.secret,
          pointages,
          recu_le: new Date().toISOString()
        });
        const f = etatDeLaFile();
        journaliser(
          `⟵ ${serial} : ${pointages.length} pointage(s) — ⚠️ serveur injoignable (${e.message}) → ` +
            `🔒 gardé(s) sur le boîtier (${f.pointages} pointage(s) en attente)`
        );
        return envoyer(200, `OK: ${pointages.length}`);
      }

      if (resultat && resultat.ok === false) {
        journaliser(`⟵ ${serial} : ${pointages.length} pointage(s) — 🔴 refusés par le serveur : ${resultat.reason || '?'}${resultat.message ? ' — ' + resultat.message : ''}`);
        // Refus métier (fuseau manquant, appareil désactivé…) : on répond OK
        // pour ne pas boucler, mais le journal et `adms_log` gardent la trace.
        return envoyer(200, `OK: ${pointages.length}`);
      }

      const coeur = (resultat && resultat.coeur) || {};
      const inconnus = resultat && resultat.pins_inconnus && Object.keys(resultat.pins_inconnus).length
        ? ` · ⚠️ PIN inconnus : ${JSON.stringify(resultat.pins_inconnus)}`
        : '';
      const ambigus = resultat && resultat.cles_ambigues
        ? ` · ⚠️ clés ambiguës (non attribuées) : ${JSON.stringify(resultat.cles_ambigues)}`
        : '';

      journaliser(
        `⟵ ${serial} : ${pointages.length} pointage(s) → ` +
          `écrits ${coeur.ecrits ?? '?'} · doublons ${coeur.doublons ?? '?'} · inconnus ${coeur.inconnus ?? '?'}` +
          `${inconnus}${ambigus}`
      );

      return envoyer(200, `OK: ${pointages.length}`);
    }

    // ── Les accusés de commande : la pointeuse rend compte ──────────────────
    if (chemin === '/iclock/devicecmd' || chemin === '/iclock/devicecmd/') {
      return envoyer(200, 'OK');
    }

    // ── Tout le reste : on répond 404 en le disant (utile pour diagnostiquer) ──
    journaliser(`⚠️ adresse inattendue appelée : ${req.method} ${chemin}`);
    return envoyer(404, 'OK');
  } catch (e) {
    journaliser(`🔴 erreur inattendue : ${e && e.message}`);
    return envoyer(500, 'OK');
  }
});

// ─── Le démarrage ───────────────────────────────────────────────────────────
serveur.listen(config.port, '0.0.0.0', () => {
  chargerLaFile();
  journaliser('════════════════════════════════════════════════════');
  journaliser('  EN-CHECK — receveur ADMS démarré');
  journaliser(`  écoute sur le port ${config.port} (toutes interfaces)`);
  journaliser(`  serveur En-Check : ${config.supabase_url || '⚠️ NON CONFIGURÉ (config.json)'}`);
  journaliser(`  appareils déclarés : ${parSerial.size}`);
  for (const [sn, a] of parSerial) journaliser(`     · ${sn}${a.label ? ' — ' + a.label : ''}`);
  if (!config.supabase_url || !config.supabase_key) {
    journaliser('  ⚠️ PAS DE CONFIGURATION : copie `config.exemple.json` en `config.json`');
    journaliser('     et remplis supabase_url / supabase_key — sinon RIEN ne sera enregistré.');
  }
  if (parSerial.size === 0) {
    journaliser('  ⚠️ AUCUN APPAREIL : copie `appareils.exemple.json` en `appareils.json`');
    journaliser('     et mets-y les numéros de série + secrets de tes pointeuses.');
  }

  const f = etatDeLaFile();
  if (f.lots > 0) {
    journaliser(`  🔒 file d'attente reprise au démarrage : ${f.pointages} pointage(s) dans ${f.lots} lot(s)`);
    journaliser(`     le plus ancien : ${String(f.plusAncien).replace('T', ' ').slice(0, 19)} — ils repartiront tout seuls`);
  } else {
    journaliser('  file d\'attente : vide');
  }
  if (lignesIllisibles > 0) {
    journaliser(`  ⚠️ ${lignesIllisibles} ligne(s) de la file n'ont pas pu être relues (fichier abîmé ?) — elles sont conservées telles quelles`);
  }

  journaliser('  page de contrôle : http://localhost:' + config.port + '/');
  journaliser('  balayage des anomalies : toutes les ' + config.balayage_minutes + ' minute(s)');

  //  La remontée de la file : un premier essai 10 secondes après le démarrage
  //  (le temps que le réseau se lève), puis à intervalle régulier.
  if (config.remontee_secondes > 0) {
    setTimeout(() => remonterLaFile('du démarrage'), 10 * 1000);
    setInterval(() => remonterLaFile('périodique'), config.remontee_secondes * 1000);
  }

  if (config.balayage_minutes > 0) {
    setTimeout(balayerLesAnomalies, 20 * 1000);
    setInterval(balayerLesAnomalies, config.balayage_minutes * 60 * 1000);
  }
  journaliser('════════════════════════════════════════════════════');
});

process.on('SIGINT', () => {
  const avant = etatDeLaFile();
  if (avant.lots > 0) {
    journaliser(`arrêt demandé — ${avant.pointages} pointage(s) restent en attente sur le boîtier, ils repartiront au prochain démarrage.`);
  } else {
    journaliser('arrêt demandé — au revoir.');
  }
  try {
    ecrireLaFile();
  } catch (e) {
    /* rien */
  }
  serveur.close(() => process.exit(0));
});
