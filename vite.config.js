import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from "vite-plugin-pwa";  

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),
    VitePWA({
      includeAssets: [                // ← actually copies them for you
        'logo192.png',
        'logo512.png',
        
      ],
      manifest: {
        name: 'Bookchain',
        short_name: 'AwesomePWA',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0A84FF',
        background_color: '#ffffff',
        icons: [
          {
            src: '/logo192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/logo512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'   // adaptive icon on Android
          }
        ]
      }
    })],

    server: {
      port: 4040, 
      strictPort: true 
    },
  
    preview: {
      port: 8000,
      strictPort: true
    }
})
