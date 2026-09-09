import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    const toast = document.createElement('div')
    toast.innerHTML = `
      <div style="position:fixed;top:20px;right:20px;background:#3D2B1F;color:white;padding:1rem;border-radius:8px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3)">
        <p style="margin:0 0 10px">✨ Nouvelle version disponible !</p>
        <button onclick="location.reload()" style="background:#E5D4C0;color:#3D2B1F;border:none;padding:8px 16px;border-radius:4px;cursor:pointer">
          Mettre à jour
        </button>
      </div>
    `
    document.body.appendChild(toast)
  },
  onOfflineReady() {
    console.log('✅ Application prête pour utilisation hors ligne')
  },
})