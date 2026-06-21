import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false, // we register manually in App.jsx
      manifest: {
        name: 'MapTheMovie',
        short_name: 'MapTheMovie',
        description: 'Solve movie clues. Find the hidden location.',
        start_url: '/',
        display: 'standalone',
        background_color: '#121218',
        theme_color: '#7C3AED',
        orientation: 'portrait',
        id: 'https://app.mapthemovie.co.uk/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  define: {
    'process.env': {}
  },
  build: {
    charset: 'utf8',
    target: 'es2015',
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('node_modules/leaflet')) return 'leaflet'
        }
      }
    }
  },
})
