/**
 * docs/maquettes/entete-retards.mjs — deux bandeaux pour RETARDS, en code vrai.
 *
 * Ce n'est PAS une image de modèle génératif : les couleurs viennent de
 * `src/styles/tokens.css` (jetons `--charte-*`), les polices de
 * `identite/fonts` (les vrais .ttf, en base64), et la marque du dépôt est
 * redessinée à partir de `src/components/EnCheckBrandMark.jsx`.
 *
 * La consigne tient en trois retraits et une contrainte :
 *   — plus de bande de motif ;
 *   — plus de raccourcis (Pointages / Planning / Employés / Rapports) ;
 *   — plus de bouton clair/sombre ;
 *   — et « arrête de proposer une forme carrée » : ni pastille carrée autour
 *     de la marque, ni bouton carré. Les formes sont RONDES ou en PILULE.
 *
 * Les deux directions ne diffèrent que par la géométrie du bandeau, pas par
 * le contenu : le retour, la marque, le titre, la date, la barre de période.
 *
 *   node docs/maquettes/entete-retards.mjs
 *   → docs/maquettes/entete-A.png, docs/maquettes/entete-B.png
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const RACINE = new URL('../../', import.meta.url).pathname
const lire = (p) => readFile(join(RACINE, p), 'utf8')

/* ── Les jetons du dépôt, lus à la source ─────────────────────────────── */
const css = await lire('src/styles/tokens.css')
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

/* ── La marque, redessinée d'après EnCheckBrandMark.jsx ────────────────── */
const marque = (taille) => `
<svg width="${taille}" height="${taille}" viewBox="0 0 100 100" fill="none" aria-hidden="true">
  <defs>
    <radialGradient id="g${taille}" cx="50" cy="48" r="50" fx="50" fy="44" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C4A574"/><stop offset="100%" stop-color="#E5D4C0"/>
    </radialGradient>
    <linearGradient id="r${taille}" x1="14" y1="10" x2="86" y2="90" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F3D9B1"/><stop offset="55%" stop-color="#C4A574"/><stop offset="100%" stop-color="#8B6914"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="48.5" fill="url(#g${taille})" stroke="url(#r${taille})" stroke-width="2"/>
  <g fill="#3D2B1F" fill-opacity="0.86">
    <path d="M 30.5 44.5 C 27 51.5 28 58.5 32.5 62.5 C 39.5 67.5 40.5 73.5 39.5 81 C 38.5 87.5 41.5 92.5 49.5 93 C 56.5 93.5 60.5 88.5 63 80.5 C 66 71 69.5 63.5 72 56.5 C 74 50.5 72.5 45.5 68.5 44 C 62.5 46.5 56 49.5 49.5 50.5 C 42.5 50.5 35.5 48 30.5 44.5 Z"/>
    <ellipse cx="35" cy="31.5" rx="7.8" ry="10.8" transform="rotate(-6 35 31.5)"/>
    <ellipse cx="48" cy="27.5" rx="5.8" ry="8.8" transform="rotate(-2 48 27.5)"/>
    <ellipse cx="59.8" cy="29.8" rx="5.2" ry="7.8" transform="rotate(5 59.8 29.8)"/>
    <ellipse cx="69.8" cy="34.2" rx="4.7" ry="6.8" transform="rotate(11 69.8 34.2)"/>
    <ellipse cx="77.8" cy="40.5" rx="4.2" ry="5.8" transform="rotate(17 77.8 40.5)"/>
  </g>
</svg>`

const fleche = (taille, couleur) => `
<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="${couleur}"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
</svg>`

/* ── La peau commune ──────────────────────────────────────────────────── */
const peau = `
:root{
${Object.entries(jetons).map(([n, v]) => `  --${n}:${v};`).join('\n')}
}
*{box-sizing:border-box}
body{
  margin:0;padding:34px 40px 40px;
  background:var(--charte-sable);color:var(--charte-encre);
  font-family:'Plex',system-ui,sans-serif;-webkit-font-smoothing:antialiased;
}
.planche{max-width:1240px;margin:0 auto}
.legende{display:flex;align-items:baseline;gap:12px;margin:0 0 18px}
.legende b{
  font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;
  color:var(--charte-aplat);
}
.legende span{font-size:12px;color:var(--charte-douce)}
.note{
  display:flex;gap:9px;align-items:flex-start;margin:0 0 16px;padding:9px 12px;
  border:1.5px solid var(--charte-bordure);border-radius:11px;
  background:var(--charte-surface);font-size:11.5px;line-height:1.45;
  color:var(--charte-douce);
}
.note b{color:var(--charte-encre)}

/* Le bandeau est ce qu'on regarde : il porte le contour et l'ombre dure. */
.bandeau{
  border:2px solid var(--charte-encre);border-radius:12px;
  box-shadow:3px 3px 0 var(--charte-encre);
  background:var(--charte-surface);overflow:hidden;
}
.marque{flex:0 0 auto;display:grid;place-items:center;line-height:0}
.titre{font-size:17px;font-weight:700;letter-spacing:-0.2px;margin:0;line-height:1.15}
.sous{font-size:10px;font-weight:600;letter-spacing:1.3px;text-transform:uppercase;
  color:var(--charte-douce);margin:3px 0 0}

/* la rangee de periode, commune aux deux directions */
.periode{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:10px 14px;border-top:2px solid var(--charte-encre);
  background:var(--charte-blanc);
}
.etiquette{
  font-size:8px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;
  color:var(--charte-aplat);
}
.champ{
  display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 13px;
  border:1.5px solid var(--charte-bordure);border-radius:999px;
  background:var(--charte-surface);
  font-family:'PlexMono',monospace;font-size:11px;font-weight:600;color:var(--charte-encre);
}
.champ.plein{background:var(--charte-encre);color:var(--charte-sable);border-color:var(--charte-encre)}
.segments{display:inline-flex;border:1.5px solid var(--charte-encre);border-radius:999px;overflow:hidden}
.segments span{
  padding:0 14px;height:30px;display:grid;place-items:center;
  font-size:8.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;
  color:var(--charte-douce);background:var(--charte-surface);
}
.segments span+span{border-left:1.5px solid var(--charte-encre)}
.segments span.on{background:var(--charte-encre);color:var(--charte-sable)}
.droite{margin-left:auto;font-family:'PlexMono',monospace;font-size:10px;color:var(--charte-douce)}
.filet{margin:26px 0 0;height:2px;background:var(--charte-bordure);border-radius:999px}
.suite{padding:14px 2px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.suite span{
  font-size:8px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;
  color:var(--charte-douce);
}
.carte-registre{
  flex:1 1 240px;height:58px;border:2px solid var(--charte-encre);border-radius:12px;
  box-shadow:3px 3px 0 var(--charte-encre);background:var(--charte-papier,#FBF4E9);
}
`

/* ══ A · LA BANDE DE REGISTRE ═══════════════════════════════════════════
   Une seule ligne, tout au même niveau : rond du retour, marque ronde,
   titre, puis la période à droite. Pas de second étage : le bandeau EST
   la ligne de titre, et la case date/segments disparaît avec elle. */
const bandeauA = `
<div class="bandeau">
  <div style="display:flex;align-items:center;gap:16px;padding:13px 16px 13px 14px">
    <!-- rond : 36 px, contour 1,5 px — jamais un carré -->
    <button style="width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;
      border:1.5px solid var(--charte-encre);border-radius:999px;
      background:var(--charte-surface);cursor:pointer;padding:0">
      ${fleche(17, J('encre'))}
    </button>

    <div class="marque">${marque(34)}</div>

    <div style="min-width:0">
      <h1 class="titre">Retards</h1>
      <p class="sous">Le registre du jour</p>
    </div>

    <div style="margin-left:auto;padding-right:2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
      <span class="etiquette">Période</span>
      <span class="champ">${'mar. 25 nov. 2026'}</span>
      <span class="segments">
        <span class="on">Jour</span><span>Semaine</span><span>Mois</span>
      </span>
    </div>
  </div>
</div>`

/* ══ B · LE TITRE QUI PORTE LE JOUR ════════════════════════════════════
   Le titre et la date entrent dans une même phrase, en gros : « Retards ·
   mardi 25 novembre ». La période n'est plus un formulaire posé dessus,
   mais la fin de la phrase. Les segments restent, en pilule, à droite. */
const bandeauB = `
<div class="bandeau">
  <div style="display:flex;align-items:center;gap:18px;padding:14px 16px 12px 14px">
    <button style="width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;
      border:1.5px solid var(--charte-encre);border-radius:999px;
      background:var(--charte-surface);cursor:pointer;padding:0">
      ${fleche(17, J('encre'))}
    </button>

    <div class="marque">${marque(40)}</div>

    <div style="min-width:0;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
      <h1 style="font-size:24px;font-weight:800;letter-spacing:-0.8px;margin:0;line-height:1">Retards</h1>
      <span style="width:5px;height:5px;border-radius:999px;background:var(--charte-aplat);
        display:inline-block;transform:translateY(-4px)"></span>
      <span style="font-family:'PlexMono',monospace;font-size:12.5px;font-weight:600;
        color:var(--charte-douce);letter-spacing:0.2px">mardi 25 novembre 2026</span>
    </div>

    <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
      <span class="segments">
        <span class="on">Jour</span><span>Semaine</span><span>Mois</span>
      </span>
    </div>
  </div>
  <div class="periode">
    <span class="etiquette">Entreprise</span>
    <span class="champ">EN-NOUS</span>
    <span style="width:1.5px;height:18px;background:var(--charte-bordure)"></span>
    <span class="droite" style="margin-left:0">12 journées évaluées · tolérance 15 min</span>
  </div>
</div>`

const fiche = (nom, mat, prevu, ecart, reel, focus) => `
  <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:6px;
    border:${focus ? '2px' : '1.5px'} solid ${focus ? J('encre') : J('bordure')};
    border-radius:11px;background:${focus ? J('blanc') : J('surface')};
    ${focus ? `box-shadow:3px 3px 0 ${J('encre')};` : ''}">
    <span style="display:grid;place-items:center;width:28px;height:28px;border-radius:999px;
      border:1.5px solid ${J('encre')};background:${J('surface2')};font-size:10px;font-weight:800">
      ${nom.split(' ').map((x) => x[0]).join('')}
    </span>
    <div style="min-width:0">
      <div style="font-size:12.5px;font-weight:800;letter-spacing:-.2px">${nom}</div>
      <div style="font-family:'PlexMono',monospace;font-size:9.5px;color:${J('douce')}">${mat}</div>
    </div>
    <div style="margin-left:auto;display:flex;align-items:center;gap:10px;
      font-family:'PlexMono',monospace">
      <span style="font-size:15px;font-weight:700">${prevu}</span>
      <span style="padding:2px 8px;border:1.5px solid ${J('encre')};border-radius:999px;
        background:${J('aplat')};color:${J('blanc')};font-size:9.5px;font-weight:700">${ecart}</span>
      <span style="font-size:15px;font-weight:700">${reel}</span>
    </div>
  </div>`

const MORCEAU_SUITE = `
<div class="filet"></div>
<div style="display:flex;align-items:baseline;justify-content:space-between;padding:14px 2px 8px">
  <span class="etiquette">Puis le registre · les fiches horaires</span>
  <span class="etiquette" style="color:var(--charte-douce)">8 fiches sur 9</span>
</div>
<div style="border:2px solid var(--charte-encre);border-radius:12px;
  box-shadow:3px 3px 0 var(--charte-encre);background:var(--charte-papier,#FBF4E9);padding:10px">
  ${fiche('Awa Dossou', 'EMP-014', '08:00', '+1 h 12', '09:12', true)}
  ${fiche('Fatou Ndiaye', 'EMP-041', '07:00', '+19 min', '07:19', false)}
  ${fiche('Koffi Mensah', 'EMP-031', '08:00', '+21 min', '08:21', false)}
</div>`

const rendre = (titre, description, bandeau) => `
<div class="planche">
  <div class="legende"><b>${titre}</b><span>${description}</span></div>
  <div class="note">
    <b>Retiré dans les deux :</b> la bande de motif, les raccourcis
    (Pointages · Planning · Employés · Rapports) et le bouton clair/sombre.
    <b>Gardé :</b> le retour, la marque, le titre, la période.
  </div>
  ${bandeau}
  ${MORCEAU_SUITE}
</div>`

const html = (corps) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${polices}</style><style>${peau}</style></head>
<body>${corps}</body></html>`

const planches = [
  ['entete-A', html(rendre('A · La bande de registre', 'une ligne, tout au même niveau', bandeauA))],
  ['entete-B', html(rendre('B · Le titre porte le jour', 'la date entre dans la phrase du titre', bandeauB))],
]

const b = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process'],
})
const page = await b.newPage({ viewport: { width: 1360, height: 600 }, deviceScaleFactor: 2 })
for (const [nom, contenu] of planches) {
  await page.setContent(contenu, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(120)
  await page.screenshot({ path: join(RACINE, `docs/maquettes/${nom}.png`), fullPage: true })
  await writeFile(join(RACINE, `docs/maquettes/${nom}.html`), contenu)
  console.log(`${nom}.png`)
}
await b.close()
