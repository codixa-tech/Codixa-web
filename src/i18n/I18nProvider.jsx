import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ar from './ar.js';
import en from './en.js';
import { parseSitePath } from '../seo/config.js';

const DICTS = { ar, en };
const I18nCtx = createContext(null);

function initialLang() {
  // Public pages: the URL decides (/ = Arabic, /en = English) so each language has its own indexable URL.
  const site = typeof window !== 'undefined' && parseSitePath(window.location.pathname);
  if (site) return site.lang;
  try {
    const saved = localStorage.getItem('codixa.lang');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {}
  return (navigator.language || 'ar').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function lookup(dict, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('codixa.lang', lang);
    } catch {}
  }, [lang]);

  const t = useCallback(
    (path, vars) => {
      let v = lookup(DICTS[lang], path);
      if (v == null) v = lookup(DICTS.en, path);
      if (v == null) {
        if (import.meta.env.DEV) console.warn('[i18n] missing key', path);
        return path;
      }
      if (typeof v === 'string' && vars) {
        v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
      }
      return v;
    },
    [lang]
  );

  // Pick the right language from a bilingual object { ar, en }, falling back to the other one.
  const pick = useCallback(
    (obj) => {
      if (obj == null) return '';
      if (typeof obj === 'string') return obj;
      return obj[lang] || obj[lang === 'ar' ? 'en' : 'ar'] || '';
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      isRTL: lang === 'ar',
      setLang,
      toggle: () => setLang((l) => (l === 'ar' ? 'en' : 'ar')),
      t,
      pick,
      // Arabic text with Latin digits: clearer for amounts, IPs, dates and phone numbers.
      locale: lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US',
    }),
    [lang, t, pick]
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
