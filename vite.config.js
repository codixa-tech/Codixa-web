import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * SEO build step: writes a static HTML file per public page and language
 * (/, /en, /erpnext, /en/erpnext, ...) with its own <title>, description, canonical, hreflang,
 * Open Graph and JSON-LD, plus the page content as crawlable HTML. Also writes sitemap.xml,
 * robots.txt and 404.html. React takes over in the browser as usual.
 */
function seoPages() {
  let outDir;
  return {
    name: 'codixa-seo-pages',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    async closeBundle() {
      const { SITE_URL, SERVICE_SLUGS, pathFor, absUrl } = await import('./src/seo/config.js');
      const { headFor } = await import('./src/seo/head.js');
      const { homeShell, serviceShell } = await import('./src/seo/shell.js');
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

      const render = (lang, slug) => {
        const h = headFor(lang, slug);
        const tags = [
          `<title>${esc(h.title)}</title>`,
          `<meta name="description" content="${esc(h.description)}" data-seo>`,
          `<link rel="canonical" href="${h.canonical}" data-seo>`,
          ...h.alternates.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" data-seo>`),
          ...Object.entries(h.og).map(([k, v]) => (k.startsWith('og:') ? `<meta property="${k}" content="${esc(v)}" data-seo>` : `<meta name="${k}" content="${esc(v)}" data-seo>`)),
          `<script type="application/ld+json" data-seo>${JSON.stringify(h.jsonld).replace(/</g, '\\u003c')}</script>`,
        ].join('\n    ');
        const shell = slug ? serviceShell(lang, slug) : homeShell(lang);
        return template
          .replace(/<html[^>]*>/, `<html lang="${h.lang}" dir="${h.dir}">`)
          .replace(/<title>[\s\S]*?<\/title>/, '')
          .replace(/<meta name="description"[^>]*>/, '')
          .replace(/<!--seo-head-->/, tags)
          .replace('<!--app-shell-->', `<div class="seo-shell">${shell}</div>`);
      };

      const pages = [];
      for (const lang of ['ar', 'en']) {
        for (const slug of ['', ...SERVICE_SLUGS]) {
          const route = pathFor(lang, slug);
          const file = route === '/' ? path.join(outDir, 'index.html') : path.join(outDir, route.slice(1), 'index.html');
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, render(lang, slug));
          pages.push({ lang, slug });
        }
      }

      // 404 for static hosts (Nginx error_page / Netlify / GitHub Pages) — not indexable.
      fs.writeFileSync(
        path.join(outDir, '404.html'),
        template.replace('<!--seo-head-->', '<meta name="robots" content="noindex">').replace('<!--app-shell-->', '')
      );

      // Template for the store pages, which Django fills per system (title, meta, JSON-LD, crawlable text).
      fs.writeFileSync(
        path.join(outDir, '_store.html'),
        template.replace('<!--seo-head-->', '<!--store-head-->').replace('<!--app-shell-->', '<!--store-shell-->')
      );

      const today = new Date().toISOString().slice(0, 10);
      const urls = pages
        .map(({ lang, slug }) => {
          const alts = ['ar', 'en']
            .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${absUrl(pathFor(l, slug))}"/>`)
            .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${absUrl(pathFor('ar', slug))}"/>`)
            .join('\n');
          return `  <url>\n    <loc>${absUrl(pathFor(lang, slug))}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${slug ? 'monthly' : 'weekly'}</changefreq>\n    <priority>${slug ? '0.8' : '1.0'}</priority>\n${alts}\n  </url>`;
        })
        .join('\n');
      fs.writeFileSync(
        path.join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`
      );
      fs.writeFileSync(
        path.join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /*?project=\n\nSitemap: ${SITE_URL}/sitemap.xml\nSitemap: ${SITE_URL}/sitemap-store.xml\n`
      );
      console.log(`\n[seo] wrote ${pages.length} pages, 404.html, sitemap.xml, robots.txt`);
    },
  };
}

export default defineConfig({
  plugins: [react(), seoPages()],
  server: {
    port: 5173,
    open: true,
    // Development: forward API and uploaded media to Django (python manage.py runserver).
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
      // Claude connector (MCP + OAuth) and the Django static files its sign-in page uses
      '/mcp': 'http://127.0.0.1:8000',
      '/oauth': 'http://127.0.0.1:8000',
      '/.well-known/oauth-': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
      // Claude connector (MCP + OAuth) and the Django static files its sign-in page uses
      '/mcp': 'http://127.0.0.1:8000',
      '/oauth': 'http://127.0.0.1:8000',
      '/.well-known/oauth-': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
