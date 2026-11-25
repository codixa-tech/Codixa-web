// <head> for the store pages, built from live data in the browser. The server sends the same tags
// for the first load (backend/store/seo.py), so crawlers see them without running JavaScript.
import { SITE_URL, absUrl } from './config.js';

const COPY = {
  ar: {
    title: 'متجر الأنظمة الجاهزة | كوديكسا',
    description: 'أنظمة جاهزة من كوديكسا: ERP وإدارة الشركات والمتاجر الإلكترونية والتعليم والرعاية الصحية. شوف المميزات والمتطلبات واحجز نسختك.',
    brand: 'كوديكسا',
  },
  en: {
    title: 'Ready-made business systems | Codixa',
    description: 'Ready-made systems by Codixa: ERP, company management, e-commerce, education and healthcare. See features and requirements, then book your copy.',
    brand: 'Codixa',
  },
};

const pathOf = (lang, slug = '') => `${lang === 'en' ? '/en' : ''}/store${slug ? `/${slug}` : ''}`;

export function storeHead(lang, system = null, pick = (o) => o?.[lang] || '') {
  const c = COPY[lang];
  const slug = system?.slug || '';
  const path = pathOf(lang, slug);
  const title = system ? `${pick(system.title)} | ${c.brand}` : c.title;
  const description = system ? (pick(system.tagline) || c.description).slice(0, 160) : c.description;
  const image = system?.images?.[0]?.src || system?.cover?.src;
  const og = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : `${SITE_URL}/brand/og-cover.jpg`;
  return {
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    title,
    description,
    canonical: absUrl(path),
    alternates: [
      { hreflang: 'ar', href: absUrl(pathOf('ar', slug)) },
      { hreflang: 'en', href: absUrl(pathOf('en', slug)) },
      { hreflang: 'x-default', href: absUrl(pathOf('ar', slug)) },
    ],
    og: {
      'og:type': 'website',
      'og:site_name': 'Codixa',
      'og:title': title,
      'og:description': description,
      'og:url': absUrl(path),
      'og:image': og,
      'og:locale': lang === 'ar' ? 'ar_EG' : 'en_US',
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': og,
    },
    jsonld: system
      ? {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: pick(system.title),
          description,
          url: absUrl(path),
          image: og,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          ...(system.price?.amount != null
            ? { offers: { '@type': 'Offer', price: String(system.price.amount), priceCurrency: system.price.currency } }
            : {}),
        }
      : { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absUrl(path) },
  };
}

export { pathOf as storePath };
