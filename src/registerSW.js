import { registerSW } from 'virtual:pwa-register'

// Retire the previous API cache on load and after the new worker takes control.
// Only this named legacy cache is removed; static assets remain available.
const retireApiCache = () => {
  if ('caches' in window) void caches.delete('api-cache').catch(() => {})
}
retireApiCache()
navigator.serviceWorker?.addEventListener('controllerchange', retireApiCache)

// ─────────────────────────────────────────────────────────────
// Mise à jour de l'app (PWA) — mode « prompt »
//
// Pourquoi ce code existe (incident 12/11) : un onglet SPA ouvert ne
// recharge jamais de document, et le navigateur ne vérifie le service
// worker que lors d'un chargement de page. Résultat : après un
// déploiement, l'utilisateur voyait SILENCIEUSEMENT l'ancienne
// version pendant des heures (le SW servait son ancien precache).
//
// → On relance la vérification : au retour sur l'onglet, au focus,
//   et toutes les 2 minutes tant que l'onglet est visible.
// → Quand une nouvelle version est détectée, on affiche un toast
//   « Mettre à jour » (le plugin recharge la page après bascule).
// ─────────────────────────────────────────────────────────────

const TOAST_ID = 'encheck-nouvelle-version'

function montrerToastMaj(mettreAJour) {
  if (document.getElementById(TOAST_ID)) return
  const toast = document.createElement('div')
  toast.id = TOAST_ID
  toast.setAttribute('role', 'status')
  toast.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'max-width:340px',
    'background:#2a1c14',
    'color:#f2e8d5',
    'border:1px solid rgba(201,169,97,0.35)',
    'padding:14px 16px',
    'border-radius:12px',
    'z-index:2147483647',
    'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
    'font-family:inherit',
    'font-size:14px',
    'line-height:1.4',
  ].join(';')
  toast.innerHTML = [
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">',
    '<span style="font-size:16px">✨</span>',
    '<strong style="color:#c9a961">Nouvelle version disponible</strong>',
    '<button data-fermer style="margin-left:auto;background:none;border:none;color:#9a8468;cursor:pointer;font-size:16px;line-height:1" aria-label="Fermer">×</button>',
    '</div>',
    '<p style="margin:0 0 12px;color:#cbb8a0">En-Check a mis à jour certaines fonctionnalités.</p>',
    '<div style="display:flex;gap:8px">',
    '<button data-annuler style="background:none;border:1px solid rgba(201,169,97,0.3);color:#cbb8a0;padding:8px 14px;border-radius:8px;cursor:pointer;font:inherit">Plus tard</button>',
    '<button data-maj style="background:#a04a22;border:none;color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font:inherit;font-weight:600">Mettre à jour</button>',
    '</div>',
  ].join('')
  document.body.appendChild(toast)
  const fermer = () => toast.remove()
  toast.querySelector('[data-maj]')?.addEventListener('click', () => {
    fermer()
    mettreAJour()
  })
  toast.querySelector('[data-annuler]')?.addEventListener('click', fermer)
  toast.querySelector('[data-fermer]')?.addEventListener('click', fermer)
}

const updateSW = registerSW({
  onNeedRefresh() {
    // Le plugin recharge automatiquement la page quand la nouvelle
    // version prend le contrôle (événement « controlling »).
    montrerToastMaj(() => updateSW().catch(() => {}))
  },
  onOfflineReady() {
    console.log('✅ Application prête pour utilisation hors ligne')
  },
})

// Relance de la vérification de mise à jour pour les onglets ouverts
// longtemps (SPA : aucun rechargement de document, sinon le navigateur
// ne checkerait le SW qu'à la prochaine ouverture de page).
function demanderMaj() {
  if (typeof document !== 'undefined' && document.hidden) return
  try {
    navigator.serviceWorker
      ?.getRegistration()
      ?.then((reg) => reg?.update?.().catch(() => {}))
  } catch {
    // Pas de SW (dev, ancien navigateur) : rien à faire.
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', demanderMaj)
}
if (typeof window !== 'undefined') {
  window.addEventListener('focus', demanderMaj)
  setInterval(demanderMaj, 120000)
}
