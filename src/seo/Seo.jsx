import { useEffect } from 'react';
import { headFor } from './head.js';
import { useSettings } from '../lib/useSettings.js';

/**
 * Keeps <head> in sync on client-side navigation. The production build also writes the same tags
 * into static HTML per page (see vite.config.js), so crawlers that do not run JavaScript see them too.
 */
export default function Seo({ lang, slug = '' }) {
  const settings = useSettings();
  useEffect(() => {
    applyHead(headFor(lang, slug, settings));
  }, [lang, slug, settings]);
  return null;
}

/** Write a head description ({ lang, dir, title, description, canonical, alternates, og, jsonld }) into <head>. */
export function applyHead(h) {
  document.documentElement.lang = h.lang;
  document.documentElement.dir = h.dir;
  document.title = h.title;
  document.head.querySelectorAll('[data-seo]').forEach((n) => n.remove());
  const add = (tag, attrs, text) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.setAttribute('data-seo', '');
    if (text) el.textContent = text;
    document.head.appendChild(el);
  };
  add('meta', { name: 'description', content: h.description });
  add('link', { rel: 'canonical', href: h.canonical });
  h.alternates.forEach((a) => add('link', { rel: 'alternate', hreflang: a.hreflang, href: a.href }));
  Object.entries(h.og).forEach(([k, v]) => add('meta', k.startsWith('og:') ? { property: k, content: v } : { name: k, content: v }));
  add('script', { type: 'application/ld+json' }, JSON.stringify(h.jsonld));
}
