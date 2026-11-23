// docs/maquettes/serveur-mois.mjs
// Le serveur des maquettes du mode mois : le même transport que serveur.mjs,
// mais posé sur la racine du projet, donc l'aperçu du bac s'ouvre DIRECTEMENT
// sur la maquette A et la bascule mène à la B.
//
//   node docs/maquettes/serveur-mois.mjs        # PORT=4173 par défaut
//
// Aucune dépendance. `/fonts/` est mappé sur `public/fonts/` comme le serveur de
// développement du dépôt, c'est ce qui fait afficher IBM Plex et non une police
// de secours.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const RACINE = new URL('../../', import.meta.url).pathname
const PORT = Number(process.env.PORT || 4173)
const ACCUEIL = '/docs/maquettes/planning-mois-A.html'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

createServer(async (req, res) => {
  try {
    let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (chemin === '/' || chemin === '/docs/maquettes/') chemin = ACCUEIL
    if (chemin.startsWith('/fonts/')) chemin = '/public' + chemin
    const complet = join(RACINE, normalize(chemin).replace(/^(\.\.[/\\])+/, ''))
    const corps = await readFile(complet)
    res.writeHead(200, {
      'content-type': TYPES[extname(complet)] || 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(corps)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Introuvable')
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Mode mois — A : http://0.0.0.0:${PORT}/  ·  B : /docs/maquettes/planning-mois-B.html`)
})
