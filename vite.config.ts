import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Caminhos relativos permitem publicar a mesma build na raiz de um domínio
  // ou em um subdiretório, como usuario.github.io/nome-do-repositorio/.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/vg7-icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'demo/*.png'],
      manifest: {
        name: 'VG7 Vistorias HVAC',
        short_name: 'VG7 HVAC',
        description: 'Vistorias visuais e documentais HVAC com funcionamento offline.',
        theme_color: '#123b35',
        background_color: '#f4f6f3',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        lang: 'pt-BR',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1400
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html']
    }
  }
})
