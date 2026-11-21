// docs/maquettes/construire.mjs
// Fabrique UN fichier HTML autonome : les trois feuilles de style du dépôt et
// les polices IBM Plex, encodées dans le fichier. Aucune sous-requête, donc
// aucun chemin relatif, aucun proxy, aucun type MIME qui puisse échouer.
//
//   node docs/maquettes/construire.mjs
//
// Le rendu reste celui du produit : ce sont les mêmes règles CSS, seulement
// transportées dans le même fichier.

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const RACINE = new URL('../../', import.meta.url).pathname
const lire = (p) => readFile(join(RACINE, p), 'utf8')

/** Les polices du dépôt, en base64 — tokenS.css les demande en /fonts/. */
async function policesEnBase64(css) {
  const noms = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1])
  let sortie = css
  for (const nom of new Set(noms)) {
    const octets = await readFile(join(RACINE, 'public/fonts', nom))
    sortie = sortie.replaceAll(
      `url('/fonts/${nom}')`,
      `url("data:font/woff2;base64,${octets.toString('base64')}") format('woff2')`,
    )
  }
  return sortie
}

/** Le corps et les <style> d'une maquette, sans ses <link> ni son module. */
function extraire(html) {
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
  const corps = html.match(/<body>([\s\S]*?)<\/body>/)[1]
    .replace(/<script[\s\S]*?<\/script>/g, '')
  return { styles, corps }
}

const tokens = await policesEnBase64(await lire('src/styles/tokens.css'))
const charte = await lire('src/styles/charte.css')
const hote = await lire('src/pages/ConfigurationPointeuse.css')

const A = extraire(await lire('docs/maquettes/maquette-A-temps-travail.html'))
const B = extraire(await lire('docs/maquettes/maquette-B-temps-travail.html'))

// La variable du motif, écrite dans le fichier (la version servie la posait en
// JavaScript). Le SVG est encodé ici, à la main : pas d'expression à évaluer.
const svgAdinkra = `<svg xmlns='http://www.w3.org/2000/svg' width='76' height='76' viewBox='0 0 76 76'><rect width='76' height='76' fill='%232A1708'/><g fill='none' stroke='%23C9A961' stroke-width='1.6'><path d='M10 10 h20 v20 h-20 z'/><path d='M46 10 h20 v20 h-20 z'/><path d='M10 46 h20 v20 h-20 z'/><path d='M46 46 h20 v20 h-20 z'/><path d='M20 20 v10 M30 20 v10 M20 30 h10'/><path d='M56 10 v20 M46 20 h20'/><path d='M10 56 h20 M20 46 v20'/><path d='M56 46 v10 M50 56 h16'/></g></svg>`
const variableMotif = `:root { --motif-adinkra: url("data:image/svg+xml,${svgAdinkra}") }`

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Onglet « Temps de travail » — deux maquettes</title>
<style>
${tokens}
${charte}
${hote}
${variableMotif}
</style>
<style>
body { margin: 0; background: #6f675e; padding: 28px 20px 60px; font-family: var(--charte-police); }
.entete { max-width: 1180px; margin: 0 auto 28px; }
.entete h1 { margin: 0 0 10px; color: #fffdf7; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
.entete p { margin: 0 0 6px; color: #e3d8c6; font-size: 14px; line-height: 1.65; max-width: 76ch; }
.entete p:last-child { color: #cbbda4; font-size: 12px; }
.sommaire { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0 0; }
.sommaire a {
  padding: 9px 14px; border: 1px solid rgba(255,253,247,.4); border-radius: 3px;
  color: #fffdf7; text-decoration: none; font-size: 12px; font-weight: 600;
}
.sommaire a:hover { background: rgba(255,253,247,.1); }
${A.styles}
${B.styles}
</style>
</head>
<body>
<div class="entete">
  <h1>Onglet « Temps de travail » — deux maquettes</h1>
  <p>Deux façons de poser les deux mêmes champs. Ce ne sont pas des images : ce sont
  les feuilles de style réelles du dépôt, dans ce fichier, rendues par ton navigateur.
  Les champs, les boutons et les badges sont donc exactement ceux que produira
  l'implémentation.</p>
  <p>Les noms, les dates et les chiffres de l'historique sont des exemples, pas des
  données réelles. Le motif est l'Adinkra de la page Pointages, à sa hauteur native de 76 px.</p>
  <div class="sommaire">
    <a href="#maquette-a">A — les deux champs nus</a>
    <a href="#maquette-b">B — la grille du kit</a>
  </div>
</div>
<div id="maquette-a">
${A.corps}
</div>
<div id="maquette-b">
${B.corps}
</div>
</body>
</html>`

const sortie = join(RACINE, 'docs/maquettes/maquettes-temps-travail.html')
await writeFile(sortie, page, 'utf8')
console.log(`Écrit : ${sortie} (${(Buffer.byteLength(page) / 1024).toFixed(0)} Ko, autonome)`)
