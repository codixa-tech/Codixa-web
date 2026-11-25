// SEO configuration shared by the React app (client-side head tags) and the build step
// (static HTML per page, sitemap.xml, robots.txt). Plain JS so Node can import it in vite.config.js.

// Production domain, no trailing slash. Set VITE_SITE_URL when building (deploy/deploy.sh takes it from
// PUBLIC_BASE_URL in backend/.env). Read from import.meta.env in the browser and process.env in the build step.
const envSiteUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SITE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_SITE_URL) ||
  '';
export const SITE_URL = (envSiteUrl || 'https://codixa.tech').replace(/\/+$/, '');

export const BRAND = 'Codixa';
export const BRAND_AR = 'كوديكسا';

/** Arabic lives at the root, English under /en. */
export const LANGS = ['ar', 'en'];
export const DEFAULT_LANG = 'ar';

/** Indexable landing pages besides the home page. Slug is shared by both languages. */
export const SERVICE_SLUGS = ['software-development', 'erpnext', 'ibm-maximo', 'training'];

export function pathFor(lang, slug = '') {
  const base = lang === 'en' ? '/en' : '';
  if (!slug) return base || '/';
  return `${base}/${slug}`;
}

export const absUrl = (path) => `${SITE_URL}${path === '/' ? '/' : path}`;

/** Parse a pathname into { lang, slug } for site pages; returns null for non-site routes. */
export function parseSitePath(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  let lang = 'ar';
  let rest = clean;
  if (clean === '/en' || clean.startsWith('/en/')) {
    lang = 'en';
    rest = clean.slice(3) || '/';
  }
  if (rest === '/') return { lang, slug: '' };
  const slug = rest.slice(1);
  if (SERVICE_SLUGS.includes(slug)) return { lang, slug };
  // Store pages: /store and /store/<system> (head tags come from the store page itself)
  if (slug === 'store' || slug.startsWith('store/')) return { lang, slug, store: true };
  return null;
}
