/// <reference types="node" />
import { createReadStream, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Lector de etiquetas (OCR con Tesseract): el motor y el modelo de español se sirven desde la propia app,
// en una carpeta con la versión para que el caché nunca mezcle versiones. Se descargan solo al usarlo.
const nm = (p: string) => fileURLToPath(new URL(`./node_modules/${p}`, import.meta.url));
const OCR_DIR = `/ocr/${JSON.parse(readFileSync(nm('tesseract.js/package.json'), 'utf-8')).version}/`;
const OCR_FILES: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'spa.traineddata.gz': '@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz',
};

function ocrFiles(): Plugin {
  return {
    name: 'forus-ocr',
    configureServer(server) {
      server.middlewares.use(OCR_DIR, (req, res, next) => {
        const src = OCR_FILES[(req.url ?? '').split('?')[0].slice(1)];
        if (!src) return next();
        res.setHeader('Content-Type', src.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        createReadStream(nm(src)).pipe(res);
      });
    },
    generateBundle() {
      for (const [name, src] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName: OCR_DIR.slice(1) + name, source: readFileSync(nm(src)) });
      }
    },
  };
}

export default defineConfig({
  define: { __OCR_DIR__: JSON.stringify(OCR_DIR) },
  plugins: [
    react(),
    ocrFiles(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Forus',
        short_name: 'Forus',
        description: 'Entrenamiento y alimentación, conectados.',
        lang: 'es-CL',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0C0C0F',
        theme_color: '#0C0C0F',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Los catálogos (data/*.json) van precargados: la app funciona sin señal desde la primera apertura.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        // El lector de etiquetas (~6 MB) no se precarga: se guarda la primera vez que se usa.
        globIgnores: ['ocr/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Al tocar la notificación de fin de descanso se vuelve a la app.
        importScripts: ['sw-notify.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'forus-ocr', expiration: { maxEntries: 8 } },
          },
          {
            // Catálogos de alimentos y ejercicios: sirve lo guardado y actualiza por detrás.
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'forus-data' },
          },
          {
            // Motor del escáner (ZXing, ~1 MB): se descarga la primera vez que se escanea y queda guardado.
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'forus-wasm', expiration: { maxEntries: 4 } },
          },
          {
            // Imágenes de ejercicios (commit fijado: nunca cambian).
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: { cacheName: 'forus-img', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'forus-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          datos: ['dexie', 'dexie-react-hooks'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          nube: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: { port: 5190 },
  preview: { port: 5191 },
});
