/**
 * docs/maquettes/retards.mjs — deux directions pour la page RETARDS, en code vrai.
 *
 * Ce n'est PAS une image de modèle génératif : chaque couleur, chaque taille,
 * chaque ombre vient des feuilles du dépôt — `src/styles/tokens.css` pour les
 * jetons `--charte-*`, `identite/fonts` pour IBM Plex (Sans et Mono, les vrais
 * .ttf), et la peau de la maison pour la géométrie : contour d'encre 2 px,
 * ombre dure décalée de 3 px SANS FLOU, rayons {6, 8, 11, 12, 999}, capitales
 * 700 / 9,5 px espacées 1,3. Une maquette qu'on ne peut pas coder n'est pas une
 * maquette (CARTE-POST-IT, méthode, point 5).
 *
 *   node docs/maquettes/retards.mjs
 *   → docs/maquettes/retards-A.png, docs/maquettes/retards-B.png
 *
 * Le rendu passe par le Chromium du bac (le même que pour les captures de
 * vérification). Les feuilles sont injectées EN LIGNE : aucun chemin relatif,
 * aucun proxy, aucune requête réseau — la planche se regarde hors du dépôt.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const RACINE = new URL('../../', import.meta.url).pathname
const lire = (p) => readFile(join(RACINE, p), 'utf8')

/* ── Les jetons du dépôt, lus à la source ─────────────────────────────── */
const css = await lire('src/styles/tokens.css')
/* ⚠️ `indexOf` rend l'offset DANS LA CHAÎNE CHERCHÉE, pas dans la découpée :
   les deux valeurs étaient identiques ici, mais la forme est piégeuse — on
   prend la marque du thème sombre, qui est le début de la seconde palette. */
const MARQUE_SOMBRE = "[data-theme='dark']"
const clair = css.includes(MARQUE_SOMBRE) ? css.slice(0, css.indexOf(MARQUE_SOMBRE)) : css
const jetons = {}
for (const [, nom, hex] of clair.matchAll(/(--charte-[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
  jetons[nom.slice(2)] = hex.toUpperCase()
}
if (!jetons['charte-sable']) throw new Error('jetons introuvables — tokens.css a changé de forme')

const J = (n) => `var(--charte-${n})`

/* ── Les polices, en base64 ────────────────────────────────────────────── */
const police = async (nom, fichier) => {
  const octets = await readFile(join(RACINE, 'identite/fonts', fichier))
  return `@font-face{font-family:'${nom}';src:url(data:font/ttf;base64,${octets.toString('base64')}) format('truetype');font-weight:400 800;font-display:block}`
}
const polices = [
  await police('Plex', 'plex-sans-400.ttf'),
  await police('PlexMono', 'plex-mono-400.ttf'),
].join('\n')

/* ══════════════════════════════════════════════════════════════════════
   LA PEAU COMMUNE — ce que les deux directions partagent
   ══════════════════════════════════════════════════════════════════════ */
const peau = `
:root{
${Object.entries(jetons).map(([n, v]) => `  --${n}:${v};`).join('\n')}
}

body{
  font-family:'Plex',system-ui,sans-serif;
  background:${J('sable')};
  color:${J('encre')};
  -webkit-font-smoothing:antialiased;
}
.planche{width:1240px;padding:26px 30px 34px;background:${J('sable')}}

/* l'en-tête de la planche : ce qu'on choisit, dit en clair */
.entete{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px}
.entete .marque{display:flex;align-items:center;gap:10px}
.entete .pastille{
  display:grid;place-items:center;width:34px;height:34px;border:2px solid ${J('encre')};
  border-radius:999px;background:${J('aplat')};color:${J('blanc')};font-weight:800;font-size:13px;
}
.entete h1{font-size:22px;font-weight:800;letter-spacing:-.4px;line-height:1.15}
.entete h1 span{color:${J('aplat')}}
.entete .sous{font-size:12px;color:${J('douce')};margin-top:3px}
.etiquette{
  font-size:9.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;
  color:${J('douce')};
}
.badge-direction{
  display:inline-flex;align-items:center;gap:8px;padding:7px 12px;
  border:2px solid ${J('encre')};border-radius:999px;background:${J('surface')};
  box-shadow:3px 3px 0 ${J('encre')};
  font-size:9.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;
}
.badge-direction b{font-size:15px;letter-spacing:0;color:${J('aplat')}}

/* la page dessinée : une feuille posée sur le sable */
.page{
  position:relative;background:${J('surface')};border:2px solid ${J('encre')};
  border-radius:12px;box-shadow:4px 4px 0 ${J('encre')};overflow:hidden;
}
/* la bande kente de la maison, en haut de page (D-003 : une seule par page) */
.kente{
  height:22px;border-bottom:2px solid ${J('encre')};
  background:
    repeating-linear-gradient(90deg,${J('encre')} 0 3px,transparent 3px 11px),
    repeating-linear-gradient(90deg,${J('aplat')} 0 24px,${J('surface2')} 24px 33px,${J('encre')} 33px 37px,${J('surface2')} 37px 60px);
}
.corps{padding:20px 22px 24px}

/* le titre de page, dans les deux directions */
.titre-page{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}
.titre-page h2{font-size:30px;font-weight:800;letter-spacing:-.9px;line-height:1}
.titre-page h2 i{color:${J('aplat')};font-style:normal}
.titre-page p{font-size:12.5px;color:${J('douce')};margin-top:6px}
.gestes{display:flex;gap:8px;flex:0 0 auto}
.bouton{
  display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;
  border:2px solid ${J('encre')};border-radius:8px;background:${J('surface2')};
  font-size:9.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;
  box-shadow:2px 2px 0 ${J('encre')};white-space:nowrap;
}
.bouton.fort{background:${J('aplat')};color:${J('blanc')}}

/* la barre de période : le ruban des jours, commun aux deux */
.periode{
  display:flex;align-items:center;gap:14px;padding:10px 12px;margin-bottom:16px;
  border:2px solid ${J('bordure')};border-radius:11px;background:${J('blanc')};
}
.periode .champ{
  display:flex;align-items:center;gap:7px;height:30px;padding:0 10px;
  border:1.5px solid ${J('bordure')};border-radius:6px;background:${J('surface')};
  font-family:'PlexMono',monospace;font-size:11.5px;font-weight:600;
}
.segments{display:flex;border:1.5px solid ${J('encre')};border-radius:999px;overflow:hidden;flex:0 0 auto}
.segments span{
  padding:7px 13px;font-size:9.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;
  border-right:1.5px solid ${J('encre')};
}
.segments span:last-child{border-right:0}
.segments .on{background:${J('encre')};color:${J('sable')}}
.periode .legende{font-size:11px;color:${J('douce')};margin-left:auto}

/* le double feutre : deux traits, jamais un flou */

/* ── les objets de la planche (classes : les styles en ligne sont écrasés
   par le reset étoile quand ils portent sur un conteneur) ── */
.carte{border:2px solid var(--charte-encre);border-radius:12px;box-shadow:3px 3px 0 var(--charte-encre);background:var(--charte-surface)}
.carte-sable{background:var(--charte-surface2)}
.fiche{border:2px solid var(--charte-bordure);border-radius:11px;background:var(--charte-surface)}
.fiche.focus{border-color:var(--charte-encre);box-shadow:3px 3px 0 var(--charte-encre);background:var(--charte-blanc)}
.compteur{display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid var(--charte-encre);border-radius:11px;background:var(--charte-surface);box-shadow:3px 3px 0 var(--charte-encre)}
.compteur .num{font-family:'PlexMono',monospace;font-size:10px;font-weight:700;color:var(--charte-douce)}
.compteur strong{font-size:27px;line-height:1;letter-spacing:-1px}
.compteur .note{font-size:10px;color:var(--charte-douce);margin-top:2px}
.rail{border:2px solid var(--charte-bordure);border-radius:11px;background:var(--charte-blanc);padding:8px 6px}
.rail .jour{text-align:center;padding:6px 0;border-radius:6px;font-family:'PlexMono',monospace;font-size:11px;color:var(--charte-douce)}
.rail .jour.on{font-size:12px;font-weight:700;background:var(--charte-encre);color:var(--charte-sable)}
.champ{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 10px;border:1.5px solid var(--charte-bordure);border-radius:6px;background:var(--charte-surface);font-family:'PlexMono',monospace;font-size:11.5px;font-weight:600}
.fiche-tete{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:11px 12px;margin-bottom:8px}
.fiche-nom{font-size:13.5px;font-weight:800;letter-spacing:-.2px}
.fiche-meta{font-family:'PlexMono',monospace;font-size:10px;color:var(--charte-douce)}
.puce{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;background:var(--charte-surface2);font-size:9.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase}
.avatar{display:grid;place-items:center;width:30px;height:30px;flex:0 0 auto;border:2px solid var(--charte-encre);border-radius:999px;background:var(--charte-surface2);font-size:11px;font-weight:800}
.billet{display:flex;align-items:center}
.billet .stop{text-align:center;min-width:62px}
.billet .stop strong{font-family:'PlexMono',monospace;font-size:17px;font-weight:700;line-height:1.1}
.billet .pont{position:relative;display:grid;place-items:center;min-width:74px;padding:0 6px}
.billet .pont i{position:absolute;left:0;right:0;top:50%;height:1.5px;background:var(--charte-bordure)}
.billet .ecart{position:relative;padding:2px 7px;border:2px solid var(--charte-encre);border-radius:999px;background:var(--charte-aplat);color:var(--charte-blanc);font-family:'PlexMono',monospace;font-size:11px;font-weight:700}
.jour-cell{position:relative;display:grid;place-items:center;height:44px;border:1.5px solid var(--charte-bordure);border-radius:8px;background:var(--charte-blanc);font-family:'PlexMono',monospace;font-size:12px;font-weight:700;color:var(--charte-encre)}
.jour-cell.plein{border-color:var(--charte-encre)}
/* le lavis est un calque SOUS le chiffre : baisser l'opacite de la case
   entiere efface aussi le chiffre — c'est ce qui s'est produit d'abord. */
.jour-cell.plein::before{content:'';position:absolute;inset:0;border-radius:6px;background:var(--charte-aplat);opacity:var(--o,.22)}
.jour-cell.cerne::after{content:'';position:absolute;inset:2px;border:1.5px solid var(--charte-encre);border-radius:6px}
.etiquette{font-size:9.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--charte-douce)}
.etiquette-xs{font-size:8px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:var(--charte-douce)}
.sep{height:1.5px;background:var(--charte-bordure);margin:8px 0}
.sep-pointille{border-top:1.5px dashed var(--charte-bordure)}
.feutre{position:relative}
.feutre::after{
  content:'';position:absolute;left:0;right:0;bottom:-4px;height:2px;
  background:${J('encre')};opacity:.85;
}
`;

/* ══════════════════════════════════════════════════════════════════════
   DIRECTION A — « LE REGISTRE DU JOUR »
   Une carte par retard, en colonne, dans l'ordre d'arrivée. Le rail des
   jours à gauche dit où l'on est dans la période. Trois registres de
   lecture : le fait (heures), le verdict (l'écart), le contexte (au clic).
   Direction qui privilégie la DÉCISION : qui relancer, aujourd'hui.
   ══════════════════════════════════════════════════════════════════════ */
const directionA = `
<div class="corps">
  <div class="titre-page">
    <div>
      <span class="etiquette">Le carnet de ponctualité</span>
      <h2>Retards<i>.</i></h2>
      <p>Chaque arrivée, replacée dans son contexte.</p>
    </div>
    <div class="gestes">
      <span class="bouton">Exporter</span>
      <span class="bouton">Règles &amp; tolérance</span>
    </div>
  </div>

  <div class="periode">
    <span class="etiquette">Entreprise</span>
    <span class="champ">EN-NOUS ▾</span>
    <span class="etiquette" style="margin-left:6px">Journée</span>
    <span class="champ">mar. 25 nov. 2026</span>
    <span class="segments"><span class="on">Jour</span><span>Semaine</span><span>Mois</span></span>
    <span class="legende">Journées évaluées : 12 · tolérance 15 min</span>
  </div>

  <!-- les trois compteurs : le fait, les gens, le temps -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid ${J('encre')};border-radius:11px;background:${J('surface')};box-shadow:3px 3px 0 ${J('encre')}">
      <span style="font-family:'PlexMono',monospace;font-size:10px;font-weight:700;color:${J('douce')}">01</span>
      <div><div class="etiquette">Retards constatés</div><strong style="font-size:27px;line-height:1;letter-spacing:-1px">7</strong></div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid ${J('encre')};border-radius:11px;background:${J('surface')};box-shadow:3px 3px 0 ${J('encre')}">
      <span style="font-family:'PlexMono',monospace;font-size:10px;font-weight:700;color:${J('douce')}">02</span>
      <div><div class="etiquette">Employés concernés</div><strong style="font-size:27px;line-height:1;letter-spacing:-1px">5</strong></div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid ${J('encre')};border-radius:11px;background:${J('surface')};box-shadow:3px 3px 0 ${J('encre')}">
      <span style="font-family:'PlexMono',monospace;font-size:10px;font-weight:700;color:${J('douce')}">03</span>
      <div><div class="etiquette">Écart cumulé</div><strong style="font-size:27px;line-height:1;letter-spacing:-1px">1 h 47</strong></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:64px 1fr 268px;gap:14px;align-items:start">
    <!-- le rail des jours : où l'on est dans la période -->
    <div style="border:2px solid ${J('bordure')};border-radius:11px;background:${J('blanc')};padding:8px 6px;display:grid;gap:2px">
      <div class="etiquette" style="text-align:center;margin-bottom:4px;font-size:8px">Nov.</div>
      <div style="text-align:center;padding:6px 0;border-radius:6px;font-family:'PlexMono',monospace;font-size:11px;color:${J('douce')}">23</div>
      <div style="text-align:center;padding:6px 0;border-radius:6px;font-family:'PlexMono',monospace;font-size:11px;color:${J('douce')}">24</div>
      <div style="text-align:center;padding:6px 0;border-radius:6px;font-family:'PlexMono',monospace;font-size:12px;font-weight:700;background:${J('encre')};color:${J('sable')}">25</div>
      <div style="text-align:center;padding:6px 0;border-radius:6px;font-family:'PlexMono',monospace;font-size:11px;color:${J('douce')}">26</div>
      <div style="text-align:center;padding:6px 0;border-radius:6px;font-family:'PlexMono',monospace;font-size:11px;color:${J('douce')}">27</div>
      <div style="height:1px;background:${J('bordure')};margin:6px 4px"></div>
      <div style="text-align:center;font-size:9px;color:${J('aplat')};font-weight:700;line-height:1.25">7<br>retards</div>
    </div>

    <!-- la pile des fiches -->
    <div style="border:2px solid ${J('encre')};border-radius:12px;box-shadow:3px 3px 0 ${J('encre')};padding:14px;background:${J('surface')}">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">
        <div><span class="etiquette">Les fiches horaires</span>
          <div style="font-size:15px;font-weight:800;letter-spacing:-.3px;margin-top:2px">Chaque arrivée raconte un horaire.</div>
        </div>
        <span class="champ" style="height:28px">⌕ Nom ou matricule</span>
      </div>

      ${[
        ['Awa Dossou', 'EMP-014', '08:00', '09:12', '+72', 'EN-NOUS', 2, 'le pire écart de la journée'],
        ['Koffi Mensah', 'EMP-031', '08:00', '08:21', '+21', 'EN-NOUS', 0],
        ['Aïcha Bello', 'EMP-007', '08:30', '08:47', '+17', 'EN-NOUS', 0],
        ['Moussa Traoré', 'EMP-022', '09:00', '09:09', '+9', 'EN-NOUS', 1],
        ['Fatou Ndiaye', 'EMP-041', '08:30', '08:36', '+6', 'EN-NOUS', 0],
      ].map(([nom, mat, prevu, reel, ecart, ent, refaites, note], i) => `
      <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:11px 12px;margin-bottom:8px;border:2px solid ${i === 0 ? J('encre') : J('bordure')};border-radius:11px;background:${i === 0 ? J('blanc') : J('surface')};${i === 0 ? `box-shadow:3px 3px 0 ${J('encre')};` : ''}">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="display:grid;place-items:center;width:30px;height:30px;flex:0 0 auto;border:2px solid ${J('encre')};border-radius:999px;background:${J('surface2')};font-size:11px;font-weight:800">${nom.split(' ').map(x => x[0]).join('')}</span>
            <div style="min-width:0">
              <div style="font-size:13.5px;font-weight:800;letter-spacing:-.2px">${nom}</div>
              <div style="font-family:'PlexMono',monospace;font-size:10px;color:${J('douce')}">${mat} · ${ent}</div>
            </div>
          </div>
          ${note ? `<div style="margin-top:7px;display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;background:${J('surface2')};font-size:9.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase">▲ ${note}</div>` : ''}
          ${refaites ? `<div style="margin-top:6px;font-size:10.5px;color:${J('douce')}">Déjà ${refaites} retard${refaites > 1 ? 's' : ''} cette semaine</div>` : ''}
        </div>
        <!-- le billet horaire : prévu → écart → réel -->
        <div style="display:flex;align-items:center;gap:0;flex:0 0 auto">
          <div style="text-align:center;min-width:62px">
            <div class="etiquette" style="font-size:8px">Prévu</div>
            <div style="font-family:'PlexMono',monospace;font-size:17px;font-weight:700;line-height:1.1">${prevu}</div>
          </div>
          <div style="position:relative;display:grid;place-items:center;min-width:74px;padding:0 6px">
            <span style="position:absolute;left:0;right:0;top:50%;height:1.5px;background:${J('bordure')}"></span>
            <span style="position:relative;padding:2px 7px;border:2px solid ${J('encre')};border-radius:999px;background:${J('aplat')};color:${J('blanc')};font-family:'PlexMono',monospace;font-size:11px;font-weight:700">${ecart}</span>
          </div>
          <div style="text-align:center;min-width:62px">
            <div class="etiquette" style="font-size:8px">Réel</div>
            <div style="font-family:'PlexMono',monospace;font-size:17px;font-weight:700;line-height:1.1">${reel}</div>
          </div>
        </div>
      </div>`).join('')}

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1.5px dashed ${J('bordure')}">
        <span style="font-size:10.5px;color:${J('douce')}">5 fiches sur 7</span>
        <span style="display:flex;align-items:center;gap:6px">
          <span style="display:grid;place-items:center;width:24px;height:24px;border:1.5px solid ${J('bordure')};border-radius:6px;font-size:11px">‹</span>
          <span style="font-family:'PlexMono',monospace;font-size:10.5px">1 / 2</span>
          <span style="display:grid;place-items:center;width:24px;height:24px;border:1.5px solid ${J('encre')};border-radius:6px;font-size:11px;background:${J('surface2')}">›</span>
        </span>
      </div>
    </div>

    <!-- la marge : l'empreinte du jour, et ce qu'on peut faire -->
    <div style="display:grid;gap:12px">
      <div style="border:2px solid ${J('encre')};border-radius:12px;box-shadow:3px 3px 0 ${J('encre')};background:${J('surface2')};padding:14px;text-align:center">
        <div class="etiquette">L'empreinte du jour</div>
        <div style="position:relative;display:grid;place-items:center;width:104px;height:104px;margin:10px auto 8px;border:2px solid ${J('encre')};border-radius:999px;background:${J('surface')}">
          <span style="position:absolute;inset:7px;border:1.5px dashed ${J('bordure')};border-radius:999px"></span>
          <div><strong style="font-size:34px;font-weight:800;letter-spacing:-1.5px;line-height:1">7</strong>
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${J('douce')}">retards</div></div>
        </div>
        <div style="font-size:11px;color:${J('douce')}">mar. 25 nov. 2026</div>
        <div style="margin-top:6px;font-size:12.5px"><strong style="font-family:'PlexMono',monospace">1 h 47</strong> d'écart cumulé</div>
        <div style="margin-top:4px;font-size:10px;color:${J('douce')}">Sur les journées évaluées, sans estimation.</div>
      </div>

      <div style="border:2px solid ${J('encre')};border-radius:12px;box-shadow:3px 3px 0 ${J('encre')};background:${J('surface')};padding:12px">
        <div class="etiquette" style="margin-bottom:8px">Ce que dit la règle</div>
        <div style="display:grid;gap:7px;font-size:11px;line-height:1.35">
          <div style="display:flex;gap:7px"><span style="color:${J('aplat')};font-weight:800">→</span><span>15 min de tolérance, grille <b>EN-NOUS — standard</b>.</span></div>
          <div style="display:flex;gap:7px"><span style="color:${J('aplat')};font-weight:800">→</span><span>Le retard se compte sur l'<b>heure prévue</b>, pas sur l'horaire moyen.</span></div>
          <div style="display:flex;gap:7px"><span style="color:${J('aplat')};font-weight:800">→</span><span>2 employés sans planning ce jour : <b>hors évaluation</b>.</span></div>
        </div>
        <div style="margin-top:10px;padding-top:9px;border-top:1.5px dashed ${J('bordure')};display:flex;align-items:center;justify-content:space-between">
          <span class="bouton" style="height:28px;box-shadow:none;background:${J('surface')}">Voir la règle</span>
          <span style="font-size:9.5px;color:${J('douce')};letter-spacing:1.1px;text-transform:uppercase;font-weight:700">Source unique</span>
        </div>
      </div>
    </div>
  </div>
</div>`;

/* ══════════════════════════════════════════════════════════════════════
   DIRECTION B — « LE PLAN DE LA SEMAINE »
   La période d'abord : une carte thermique des jours × heures, qui montre
   QUAND les retards arrivent. Puis une table dense, triable, où l'on peut
   comparer d'un regard et cocher en lot. Direction qui privilégie la
   TENDANCE : est-ce le lundi ? le service du matin ?
   ══════════════════════════════════════════════════════════════════════ */
const directionB = `
<div class="corps">
  <div class="titre-page">
    <div>
      <span class="etiquette">Le carnet de ponctualité</span>
      <h2>Retards<i>.</i></h2>
      <p>Chaque arrivée, replacée dans son contexte.</p>
    </div>
    <div class="gestes">
      <span class="bouton">Exporter</span>
      <span class="bouton fort">Relancer les 3 concernés</span>
    </div>
  </div>

  <div class="periode">
    <span class="etiquette">Entreprise</span>
    <span class="champ">EN-NOUS ▾</span>
    <span class="etiquette" style="margin-left:6px">Semaine du</span>
    <span class="champ">lun. 23 — dim. 29 nov.</span>
    <span class="segments"><span>Jour</span><span class="on">Semaine</span><span>Mois</span></span>
    <span class="legende">Cumul de la semaine : 19 retards · 4 h 12</span>
  </div>

  <div style="display:grid;grid-template-columns:1fr 300px;gap:14px;align-items:start;margin-bottom:14px">
    <!-- la carte thermique : les jours en colonnes, les heures en lignes -->
    <div style="border:2px solid ${J('encre')};border-radius:12px;box-shadow:3px 3px 0 ${J('encre')};background:${J('surface')};padding:14px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">
        <div><span class="etiquette">Quand arrivent les retards</span>
          <div style="font-size:15px;font-weight:800;letter-spacing:-.3px;margin-top:2px">La semaine en un regard.</div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:${J('douce')}">
          <span class="etiquette" style="font-size:8px">peu</span>
          ${[0.14, 0.32, 0.5, 0.72, 1].map(o => `<span style="width:13px;height:13px;border:1.5px solid ${J('encre')};border-radius:3px;background:${J('aplat')};opacity:${o}"></span>`).join('')}
          <span class="etiquette" style="font-size:8px">beaucoup</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:56px repeat(7,1fr);gap:5px;align-items:center">
        <div></div>
        ${['Lun 23', 'Mar 24', 'Mer 25', 'Jeu 26', 'Ven 27', 'Sam 28', 'Dim 29'].map((j, i) => `
          <div style="text-align:center;font-size:9.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${i === 2 ? J('encre') : J('douce')};${i === 2 ? `text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;` : ''}">${j}</div>`).join('')}

        ${[
          ['06–08', [0, 0, 0, 0, 0, 0, 0]],
          ['08–10', [3, 2, 4, 1, 3, 0, 0]],
          ['10–12', [1, 0, 2, 0, 0, 0, 0]],
          ['12–14', [0, 1, 1, 0, 1, 0, 0]],
          ['14–16', [0, 0, 0, 0, 0, 0, 0]],
        ].map(([h, vals]) => `
          <div class="etiquette-xs" style="text-align:right;padding-right:4px">${h}</div>
          ${vals.map((v, i) => `
            <div class="jour-cell${v ? ' plein' : ''}${i === 2 && v ? ' cerne' : ''}" style="${v ? `--o:${(0.22 + Math.min(v, 4) * 0.2).toFixed(2)}` : ''}">${v || ''}</div>`).join('')}`).join('')}
      </div>
      <div style="margin-top:10px;padding-top:9px;border-top:1.5px dashed ${J('bordure')};display:flex;gap:18px;font-size:10.5px;color:${J('douce')}">
        <span><b style="color:${J('encre')}">Le matin de 8 à 10 h</b> porte 13 des 19 retards.</span>
        <span>Le lundi concentre <b style="color:${J('encre')}">4</b> retards.</span>
      </div>
    </div>

    <!-- les trois compteurs, en colonne : la lecture de la période -->
    <div style="display:grid;gap:10px">
      ${[
        ['Retards constatés', '19', 'sur 5 jours évalués'],
        ['Employés concernés', '6', 'sur 11 évaluables'],
        ['Écart cumulé', '4 h 12', 'moyenne 13 min par retard'],
      ].map(([lib, val, note], i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:11px 13px;border:2px solid ${J('encre')};border-radius:11px;background:${J('surface')};box-shadow:3px 3px 0 ${J('encre')}">
          <span style="font-family:'PlexMono',monospace;font-size:10px;font-weight:700;color:${J('douce')}">0${i + 1}</span>
          <div style="min-width:0">
            <div class="etiquette">${lib}</div>
            <strong style="font-size:26px;line-height:1;letter-spacing:-1px">${val}</strong>
            <div style="font-size:10px;color:${J('douce')};margin-top:2px">${note}</div>
          </div>
        </div>`).join('')}
    </div>
  </div>

  <!-- la table dense : comparer d'un regard, agir en lot -->
  <div style="border:2px solid ${J('encre')};border-radius:12px;box-shadow:3px 3px 0 ${J('encre')};background:${J('surface')};overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:2px solid ${J('encre')}">
      <div><span class="etiquette">Le tableau de la période</span>
        <div style="font-size:14px;font-weight:800;letter-spacing:-.3px;margin-top:2px">19 lignes, 6 employés.</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="champ" style="height:28px">⌕ Nom ou matricule</span>
        <span class="bouton" style="height:28px;box-shadow:none">Trier : écart ▾</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:30px 1.5fr .8fr .7fr .7fr .7fr .9fr">
      ${['', 'Employé', 'Jour', 'Prévu', 'Réel', 'Écart', 'Entreprise'].map((h, i) => `
        <div style="padding:8px 10px;background:${J('surface2')};border-bottom:1.5px solid ${J('encre')};font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${J('douce')};${i > 2 && i < 6 ? 'text-align:right;' : ''}">${h}</div>`).join('')}

      ${[
        [1, 'Awa Dossou', 'EMP-014', 'mar. 25 nov.', '08:00', '09:12', '+72', 'EN-NOUS', 'matin · 2ᵉ fois'],
        [1, 'Koffi Mensah', 'EMP-031', 'mar. 25 nov.', '08:00', '08:21', '+21', 'EN-NOUS', ''],
        [0, 'Aïcha Bello', 'EMP-007', 'mar. 25 nov.', '08:30', '08:47', '+17', 'EN-NOUS', ''],
        [0, 'Moussa Traoré', 'EMP-022', 'lun. 24 nov.', '09:00', '09:34', '+34', 'EN-NOUS', 'matin'],
        [0, 'Fatou Ndiaye', 'EMP-041', 'lun. 24 nov.', '08:30', '08:36', '+6', 'EN-NOUS', ''],
        [1, 'Awa Dossou', 'EMP-014', 'lun. 24 nov.', '08:00', '08:44', '+44', 'EN-NOUS', 'matin · 2ᵉ fois'],
        [0, 'Koffi Mensah', 'EMP-031', 'lun. 24 nov.', '08:00', '08:12', '+12', 'EN-NOUS', ''],
        [0, 'Ibrahim Sow', 'EMP-055', 'ven. 27 nov.', '07:00', '07:19', '+19', 'EN-NOUS', 'ouverture'],
      ].map(([coche, nom, mat, jour, prevu, reel, ecart, ent, note], i) => `
        <div style="display:contents">
          <div style="display:grid;place-items:center;padding:9px 6px;border-bottom:1px solid ${J('bordure')};background:${i % 2 ? J('blanc') : 'transparent'}">
            <span style="display:grid;place-items:center;width:16px;height:16px;border:1.5px solid ${coche ? J('encre') : J('bordure')};border-radius:4px;background:${coche ? J('aplat') : 'transparent'};color:${J('blanc')};font-size:10px;font-weight:800">${coche ? '✓' : ''}</span>
          </div>
          <div style="padding:9px 10px;border-bottom:1px solid ${J('bordure')};background:${i % 2 ? J('blanc') : 'transparent'}">
            <div style="font-size:12.5px;font-weight:700">${nom}</div>
            <div style="font-family:'PlexMono',monospace;font-size:9.5px;color:${J('douce')}">${mat}${note ? ' · ' + note : ''}</div>
          </div>
          <div style="padding:9px 10px;border-bottom:1px solid ${J('bordure')};background:${i % 2 ? J('blanc') : 'transparent'};font-size:11px;color:${J('douce')}">${jour}</div>
          <div style="padding:9px 10px;border-bottom:1px solid ${J('bordure')};background:${i % 2 ? J('blanc') : 'transparent'};text-align:right;font-family:'PlexMono',monospace;font-size:12px">${prevu}</div>
          <div style="padding:9px 10px;border-bottom:1px solid ${J('bordure')};background:${i % 2 ? J('blanc') : 'transparent'};text-align:right;font-family:'PlexMono',monospace;font-size:12px">${reel}</div>
          <div style="padding:9px 10px;border-bottom:1px solid ${J('bordure')};background:${i % 2 ? J('blanc') : 'transparent'};text-align:right">
            <span style="display:inline-block;padding:2px 7px;border:1.5px solid ${J('encre')};border-radius:999px;background:${J('aplat')};color:${J('blanc')};font-family:'PlexMono',monospace;font-size:10.5px;font-weight:700">${ecart}</span>
          </div>
          <div style="padding:9px 10px;border-bottom:1px solid ${J('bordure')};background:${i % 2 ? J('blanc') : 'transparent'};font-size:10.5px;color:${J('douce')}">${ent}</div>
        </div>`).join('')}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px">
      <span style="font-size:10.5px;color:${J('douce')}">8 lignes sur 19 · <b style="color:${J('encre')}">3 sélectionnées</b></span>
      <span style="display:flex;align-items:center;gap:6px">
        <span style="display:grid;place-items:center;width:24px;height:24px;border:1.5px solid ${J('bordure')};border-radius:6px;font-size:11px">‹</span>
        <span style="font-family:'PlexMono',monospace;font-size:10.5px">1 / 3</span>
        <span style="display:grid;place-items:center;width:24px;height:24px;border:1.5px solid ${J('encre')};border-radius:6px;font-size:11px;background:${J('surface2')}">›</span>
      </span>
    </div>
  </div>
</div>`;

const entete = (lettre, titre, sous, points) => `
<div class="entete">
  <div class="marque">
    <span class="pastille">R</span>
    <div>
      <h1>Retards<span>.</span> <span style="color:${J('douce')};font-weight:600">— maquette</span> ${lettre}</h1>
      <div class="sous">${titre} · ${sous}</div>
    </div>
  </div>
  <div style="display:grid;gap:4px;max-width:520px">
    ${points.map((p) => `<div style="font-size:11px;line-height:1.35"><b style="color:${J('aplat')}">—</b> ${p}</div>`).join('')}
  </div>
</div>`

const A = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}${polices}${peau}</style></head><body>
<div class="planche">
  ${entete('A', 'Le registre du jour', 'la décision — qui relancer, aujourd’hui', [
    'Une carte par retard, dans l’ordre d’arrivée : lire de haut en bas à l’échelle de la journée.',
    'Le rail des jours, à gauche, dit où l’on est dans la période sans quitter la page.',
    'La marge donne l’empreinte du jour ET ce que dit la règle — le contexte à côté du fait.',
    'Un seul focus visuel : la fiche au plus gros écart, cerclée et soulevée.',
  ])}
  <div class="page"><div class="kente"></div>${directionA}</div>
</div></body></html>`

const B = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}${polices}${peau}</style></head><body>
<div class="planche">
  ${entete('B', 'Le plan de la semaine', 'la tendance — quand et qui, d’un regard', [
    'La carte thermique jours × heures répond d’abord à « quand » : le lundi ? le matin ?',
    'Les trois compteurs en colonne, à droite, résument la période sans occuper le centre.',
    'Une table dense, triable et cochable : comparer les écarts, agir en lot.',
    'À lire comme un tableau de bord de service, pas comme un journal d’arrivées.',
  ])}
  <div class="page"><div class="kente"></div>${directionB}</div>
</div></body></html>`

const dossier = join(RACINE, 'docs/maquettes')
await writeFile(join(dossier, 'retards-A.html'), A, 'utf8')
await writeFile(join(dossier, 'retards-B.html'), B, 'utf8')

/* ── Le rendu : Chromium headless, même outillage que les captures ────── */
const b = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process'],
})
const page = await b.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 })
for (const [nom, html] of [['retards-A', A], ['retards-B', B]]) {
  await page.setContent(html, { waitUntil: 'load' })
  await page.waitForTimeout(400)
  await page.locator('.planche').screenshot({ path: join(dossier, `${nom}.png`) })
  const taille = await page.locator('.planche').boundingBox()
  console.log(nom, `${Math.round(taille.width)}×${Math.round(taille.height)}`)
}
await b.close()
