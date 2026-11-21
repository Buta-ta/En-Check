// docs/maquettes/serveur.mjs
// Sert les maquettes avec les vraies feuilles de style du dépôt.
// Aucune dépendance : node docs/maquettes/serveur.mjs
//
// Le seul écart avec Vite : `/fonts/...` est mappé sur `public/fonts/...`,
// comme le fait le serveur de développement du dépôt. C'est ce qui permet
// à la maquette d'afficher IBM Plex et non une police de secours.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const RACINE = new URL('../../', import.meta.url).pathname
const PORT = Number(process.env.PORT || 5173)

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
    if (chemin === '/' || chemin === '/docs/maquettes/') {
      chemin = '/docs/maquettes/maquettes-temps-travail.html'
    }
    // `/fonts/` → public/fonts (convention Vite du dépôt)
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
  console.log(`Maquettes : http://0.0.0.0:${PORT}/docs/maquettes/maquette-A-temps-travail.html`)
})
