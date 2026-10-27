import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: { port: 3000 },
  preview: { port: 3000 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/main.tsx so updates load straight away
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Farm Manager',
        short_name: 'Farm',
        description: 'Fields, crops, livestock and sales for the farm',
        lang: 'en-ZA',
        theme_color: '#1f5f2e',
        background_color: '#f3f1ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app itself always opens offline. Farm data read recently is kept for offline viewing.
        // Satellite tiles are not stored by the app (Esri terms); the browser's normal cache still applies.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
    }),
  ],
})
