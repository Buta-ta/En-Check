import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      
      includeAssets: ['favicon.ico', 'pwa-192x192.png', 'pwa-512x512.png'],
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // ✅ 4 Mo
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60
              }
            }
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60
              }
            }
          }
        ]
      },
      
      manifest: {
        name: 'En-Check Admin',
        short_name: 'En-Check',
        description: 'Gestion de pointage - Administration',
        theme_color: '#3D2B1F',
        background_color: '#E5D4C0',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        id: '/',
        lang: 'fr',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Dashboard En-Check'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Dashboard En-Check'
          }
        ]
      },
      
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor'
            if (id.includes('@supabase')) return 'supabase-vendor'
            return 'vendor'
          }
        }
      }
    }
  },
  
  resolve: {
    alias: {
      // ⚠️ RETIRÉ le 26/09/2026 — cet alias pointait vers un fichier INTERNE de @supabase/supabase-js
      //    ('dist/module/index.js'). Ce fichier n'existe PLUS depuis la version 2.90.0 (aujourd'hui : 2.109.0).
      //    Tant que package-lock.json fige 2.87.3, le build passe — mais dès un « npm update »,
      //    une suppression du lock ou une installation vierge, le build meurt sur :
      //      Could not load @supabase/supabase-js/dist/module/index.js : ENOENT
      //    Vite résout maintenant le paquet par son champ « exports » officiel (dist/index.mjs) : testé, OK.
      //    Pour revenir en arrière : décommenter la ligne ci-dessous.
      // '@supabase/supabase-js': '@supabase/supabase-js/dist/module/index.js'
    }
  },
  
    // ─────────────────────────────────────────────────────────────────────────
  //  SERVEUR LOCAL (ta machine seulement)
  // ─────────────────────────────────────────────────────────────────────────
  //  Le HTTPS local sert à tester l'appareil photo et la géolocalisation.
  //  MAIS les certificats vivent dans .cert/, un dossier exclu par .gitignore :
  //  il n'existe donc PAS sur Vercel. Les lire sans vérifier leur présence
  //  faisait mourir le build ENTIER avant même la compilation :
  //      Error: ENOENT: no such file or directory, open './.cert/localhost-key.pem'
  //
  //  On ne les lit donc QUE s'ils existent. Vercel gère son propre HTTPS :
  //  il n'y a rien à configurer de ce côté-là.
  //
  //  En résumé :
  //      en local  → .cert/ présent  → HTTPS activé  (comme avant, aucun changement)
  //      sur Vercel→ .cert/ absent   → HTTPS ignoré  (le build passe enfin)
  server: (() => {
    const cle = './.cert/localhost-key.pem'
    const cert = './.cert/localhost.pem'
    if (fs.existsSync(cle) && fs.existsSync(cert)) {
      return {
        https: {
          key: fs.readFileSync(cle),
          cert: fs.readFileSync(cert),
        },
        port: 5173,
      }
    }
    return { port: 5173 }
  })(),
})