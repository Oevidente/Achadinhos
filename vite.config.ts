import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

import {VitePWA} from 'vite-plugin-pwa';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function normalizarBase(rawBase?: string): string {
  const limpa = (rawBase || '/').trim();
  if (!limpa || limpa === '/') return '/';
  const comBarraInicio = limpa.startsWith('/') ? limpa : `/${limpa}`;
  return comBarraInicio.endsWith('/') ? comBarraInicio : `${comBarraInicio}/`;
}

function gerarHtml404GitHubPages(base: string): string {
  const baseJson = JSON.stringify(base);
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redirecionando — Achadinhos do Deco</title>
    <script>
      (function () {
        var base = ${baseJson};
        var l = window.location;
        var pathname = l.pathname || '/';
        var prefix = base === '/' ? '' : base.slice(0, -1);
        var rel = prefix && pathname.indexOf(prefix) === 0
          ? pathname.slice(prefix.length) || '/'
          : pathname;
        if (rel.charAt(0) !== '/') rel = '/' + rel;
        var rotaCompleta = rel + (l.search || '') + (l.hash || '');
        var destino = base + '?gh_route=' + encodeURIComponent(rotaCompleta);
        l.replace(destino);
      })();
    </script>
  </head>
  <body style="background:#070A07;color:#F8FAFC;font-family:sans-serif;padding:2rem;">
    Redirecionando...
  </body>
</html>
`;
}

export default defineConfig(() => {
  const base = normalizarBase(process.env.VITE_BASE_PATH);

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: base,
          name: 'Achadinhos do Deco — Ofertas em Promoção',
          short_name: 'Achadinhos',
          description:
            'Curadoria de ofertas e promoções de Shopee, Mercado Livre, Amazon, TikTok Shop, Magalu e outros marketplaces.',
          theme_color: '#070A07',
          background_color: '#070A07',
          display: 'standalone',
          start_url: base,
          scope: base,
          lang: 'pt-BR',
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      // Copies src/assets into dist/ and generates GitHub Pages SPA fallback files.
      {
        name: 'copy-unbundled-src-assets-and-gh-pages',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
          if (fs.existsSync(distDir)) {
            fs.writeFileSync(path.join(distDir, '404.html'), gerarHtml404GitHubPages(base), 'utf8');
            fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
