import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

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
      // Copies src/assets into dist/ and generates GitHub Pages SPA fallback files.
      {
        name: 'copy-unbundled-src-assets-and-gh-pages',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
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
        '@': path.resolve(__dirname, '.'),
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
