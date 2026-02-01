import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Met à jour l'app automatiquement
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'En-Check Admin',
        short_name: 'En-Check',
        description: 'Dashboard de gestion de pointage',
        theme_color: '#3D2B1F', // Brun profond (barre du haut)
        background_color: '#E5D4C0', // Sable clair (fond de chargement)
        display: 'standalone', // Cache la barre d'URL du navigateur (fait comme une vraie app)
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Pour Android qui arrondit les icônes
          }
        ]
      }
    })
  ],
})