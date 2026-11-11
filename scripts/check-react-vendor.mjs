// Preuve (a) : le chunk react-vendor est autonome — il se charge seul dans
// Node SANS aucun DOM, et expose un React fonctionnel (forwardRef défini).
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = path.join(process.cwd(), 'dist', 'assets')
const f = fs.readdirSync(dir).find((x) => x.startsWith('react-vendor-') && x.endsWith('.js'))
if (!f) {
  console.error('chunk react-vendor introuvable')
  process.exit(2)
}
const m = await import(pathToFileURL(path.join(dir, f)).href)
const keys = Object.keys(m)
const react = keys
  .map((k) => m[k])
  .find((v) => v && typeof v === 'object' && typeof v.forwardRef === 'function')
console.log('react-vendor chargé seul, sans DOM  :', f)
console.log('nb exports                           :', keys.length)
console.log('React.forwardRef (function)          :', !!react)
console.log('React.useContext (function)          :', typeof (react?.useContext) === 'function')
console.log('React.createRoot (function)          :', typeof (react?.createRoot) === 'function')
if (!react || typeof react.forwardRef !== 'function') process.exit(1)
console.log('✅ react-vendor est autonome et fournit un React valide')
