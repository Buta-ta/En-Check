// Repro locale du bug « Cannot read properties of undefined (reading 'forwardRef') »
// Exécute le bundle ESM de production dans Node avec un DOM minimal.
// Le bug se joue AUSSI À L'INITIALISATION des modules (ordre d'évaluation),
// donc un simple `import` de l'entrée suffit à le déclencher.
const path = require('path')
const fs = require('fs')
const assets = path.join(__dirname, '..', 'dist', 'assets')

const noop = () => {}
const makeEl = (extra = {}) => ({
  style: {},
  nodeType: 1,
  nodeName: 'DIV',
  childNodes: [],
  setAttribute: noop,
  appendChild(c) {
    this.childNodes.push(c)
    return c
  },
  insertBefore(c) {
    this.childNodes.unshift(c)
    return c
  },
  removeChild: () => {},
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: () => true,
  classList: { add: noop, remove: noop, contains: () => false, toggle: noop },
  querySelector: () => null,
  querySelectorAll: () => [],
  getAttribute: () => null,
  getContext: () => null,
  ownerDocument: null,
  width: 0,
  height: 0,
  scrollWidth: 0,
  scrollHeight: 0,
  textContent: '',
  innerHTML: '',
  getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }),
  ...extra,
})
const el = () => makeEl()
const rootEl = makeEl({ id: 'root' })

globalThis.window = globalThis
globalThis.self = globalThis
if (typeof globalThis.addEventListener !== 'function') {
  globalThis.addEventListener = () => {}
  globalThis.removeEventListener = () => {}
}
const fakeSheet = {
  cssRules: [],
  _data: '',
  get data() {
    return this._data
  },
  set data(v) {
    this._data = String(v)
  },
  get cssText() {
    return this._data
  },
  set cssText(v) {
    this._data = String(v)
  },
  insertRule: (r, index) => {
    if (index === undefined || index > fakeSheet.cssRules.length) {
      fakeSheet.cssRules.push(String(r))
    } else {
      fakeSheet.cssRules.splice(index, 0, String(r))
    }
    fakeSheet._data = fakeSheet.cssRules.join('\n')
    return fakeSheet.cssRules.length - 1
  },
  deleteRule: (i) => fakeSheet.cssRules.splice(i, 1),
  removeRule: (i) => fakeSheet.cssRules.splice(i, 1),
  ownerNode: el(),
  ownerNode_: el(),
}
const headEl = el()
headEl.appendChild = (c) => {
  c.parentNode = headEl
  headEl.childNodes.push(c)
  return c
}
globalThis.document = {
  createElement: (tag) => {
    const e = el()
    e.parentNode = null
    if (String(tag).toLowerCase() === 'style') {
      // Goober (moteur CSS de @stitches/react) lit styleEl.firstChild.data
      // (le nœud texte du <style>) et l'ajoute dans document.head.
      const textNode = { data: ' ' }
      e.firstChild = textNode
      e.childNodes = [textNode]
      let inner = ' '
      Object.defineProperty(e, 'innerHTML', {
        get: () => inner,
        set: (v) => {
          inner = String(v)
          textNode.data = inner
        },
      })
      e.appendChild = (n) => {
        if (n && n.data !== undefined) {
          e.firstChild = n
          e.childNodes.push(n)
        }
      }
      e.sheet = fakeSheet
      e.styleSheet = fakeSheet
    }
    return e
  },
  createTextNode: (v) => ({ nodeType: 3, data: String(v) }),
  createDocumentFragment: () => makeEl({ nodeType: 11 }),
  addEventListener: noop,
  removeEventListener: noop,
  querySelector: (sel) => (sel === '#root' ? rootEl : null),
  querySelectorAll: () => [],
  getElementById: (id) => (id === 'root' ? rootEl : null),
  head: headEl,
  body: el(),
  documentElement: el(),
  styleSheets: [fakeSheet],
  visibilityState: 'visible',
}
rootEl.ownerDocument = globalThis.document
headEl.ownerDocument = globalThis.document
globalThis.navigator = {
  userAgent: 'node-repro',
  language: 'fr-FR',
  languages: ['fr-FR'],
  clipboard: { writeText: async () => {} },
  onLine: true,
  serviceWorker: { register: async () => ({}) },
}
globalThis.location = {
  href: 'http://localhost/',
  origin: 'http://localhost',
  protocol: 'http:',
  host: 'localhost',
  hostname: 'localhost',
  pathname: '/',
  search: '',
  hash: '',
}
globalThis.screen = {
  width: 1920,
  height: 1080,
  availWidth: 1920,
  availHeight: 1080,
  colorDepth: 24,
  pixelDepth: 24,
  orientation: { type: 'landscape', angle: 0 },
}
const store = { getItem: () => null, setItem: noop, removeItem: noop, clear: noop }
globalThis.localStorage = store
globalThis.sessionStorage = store
globalThis.matchMedia = () => ({
  matches: false,
  media: '',
  addListener: noop,
  removeListener: noop,
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: () => false,
})
class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalThis.IntersectionObserver = Observer
globalThis.ResizeObserver = Observer
globalThis.MutationObserver = Observer
globalThis.EventTarget = class EventTarget {
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true
  }
}
globalThis.Event = class Event {
  constructor(type) {
    this.type = type
  }
}
globalThis.CustomEvent = class CustomEvent extends globalThis.Event {
  constructor(type, opts = {}) {
    super(type)
    this.detail = opts.detail
  }
}
globalThis.HTMLElement = class HTMLElement {}
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.fetch = () => Promise.resolve({ ok: true, status: 200, json: async () => ({}) })

process.env.NODE_ENV = 'production'

const indexFile = fs.readdirSync(assets).find((f) => f.startsWith('index-') && f.endsWith('.js'))
if (!indexFile) {
  console.error('entrée non trouvée dans', assets)
  process.exit(2)
}

;(async () => {
  const t0 = Date.now()
  try {
    await import(path.join(assets, indexFile))
    console.log(`✅ IMPORT OK en ${Date.now() - t0} ms — aucune erreur à l'initialisation des modules`)
  } catch (e) {
    console.error(`❌ ERREUR À L'INITIALISATION (après ${Date.now() - t0} ms) :`)
    console.error('   ' + e.message)
    console.error(
      '   ' +
        (e.stack || '')
          .split('\n')
          .slice(1, 6)
          .map((l) => '   ' + l)
          .join('\n'),
    )
    process.exitCode = 1
  }
  // On coupe la boucle événementielle éventuelle.
  setTimeout(() => process.exit(process.exitCode || 0), 300)
})()
