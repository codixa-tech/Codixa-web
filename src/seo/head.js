// Builds everything that goes in <head> for a page: title, description, canonical, hreflang,
// Open Graph / Twitter and JSON-LD structured data. Shared by the React <Seo> component
// (client navigation, dev server) and the build step (static HTML for crawlers).
import { SITE_URL, BRAND, BRAND_AR, SERVICE_SLUGS, pathFor, absUrl } from './config.js';
import { PAGES, HOME_FAQ } from './pages.js';
import { SITE } from '../config/site.js';

const OG_IMAGE = `${SITE_URL}/brand/og-cover.jpg`;

export function headFor(lang, slug = '', settings = null) {
  const key = slug || 'home';
  const page = PAGES[key][lang];
  const path = pathFor(lang, slug);
  const url = absUrl(path);
  const alternates = [
    { hreflang: 'ar', href: absUrl(pathFor('ar', slug)) },
    { hreflang: 'en', href: absUrl(pathFor('en', slug)) },
    { hreflang: 'x-default', href: absUrl(pathFor('ar', slug)) },
  ];
  return {
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    title: page.title,
    description: page.description,
    canonical: url,
    alternates,
    og: {
      'og:type': 'website',
      'og:site_name': BRAND,
      'og:title': page.title,
      'og:description': page.description,
      'og:url': url,
      'og:image': OG_IMAGE,
      'og:image:width': '1640',
      'og:image:height': '624',
      'og:locale': lang === 'ar' ? 'ar_EG' : 'en_US',
      'og:locale:alternate': lang === 'ar' ? 'en_US' : 'ar_EG',
      'twitter:card': 'summary_large_image',
      'twitter:title': page.title,
      'twitter:description': page.description,
      'twitter:image': OG_IMAGE,
    },
    jsonld: jsonLdFor(lang, slug, settings),
  };
}

function organization(lang, settings) {
  const s = settings || {};
  // Only real profile URLs (with a path), not bare domains like https://www.linkedin.com/
  const social = Object.values(s.social || SITE.social || {}).filter((v) => v && /^https?:\/\/[^/]+\/[^/?#]+/.test(v));
  return {
    '@type': ['Organization', 'ProfessionalService'],
    '@id': `${SITE_URL}/#organization`,
    name: BRAND,
    alternateName: BRAND_AR,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/brand/apple-touch-icon.png`,
    image: OG_IMAGE,
    email: s.email || SITE.email,
    telephone: s.phone || SITE.phone,
    address: { '@type': 'PostalAddress', addressLocality: lang === 'ar' ? 'القاهرة' : 'Cairo', addressCountry: 'EG' },
    areaServed: [
      { '@type': 'Country', name: 'Egypt' },
      { '@type': 'Country', name: 'Saudi Arabia' },
    ],
    knowsAbout: ['Software development', 'ERPNext', 'Frappe', 'IBM Maximo', 'Maximo Application Suite', 'Mobile app development', 'Artificial intelligence', 'Robotics', 'Programming training'],
    ...(social.length ? { sameAs: [...new Set(social)] } : {}),
  };
}

function faqPage(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

function jsonLdFor(lang, slug, settings) {
  const graph = [organization(lang, settings)];
  const inLanguage = lang === 'ar' ? 'ar' : 'en';
  if (!slug) {
    graph.push({
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: BRAND,
      alternateName: BRAND_AR,
      inLanguage: ['ar', 'en'],
      publisher: { '@id': `${SITE_URL}/#organization` },
    });
    graph.push({
      '@type': 'ItemList',
      name: lang === 'ar' ? 'خدمات كوديكسا' : 'Codixa services',
      itemListElement: SERVICE_SLUGS.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: PAGES[s][lang].crumb,
        url: absUrl(pathFor(lang, s)),
      })),
    });
    graph.push(faqPage(HOME_FAQ[lang]));
  } else {
    const p = PAGES[slug][lang];
    const url = absUrl(pathFor(lang, slug));
    graph.push({
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: p.title,
      description: p.description,
      inLanguage,
      isPartOf: { '@id': `${SITE_URL}/#website` },
    });
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: BRAND, item: absUrl(pathFor(lang)) },
        { '@type': 'ListItem', position: 2, name: p.crumb, item: url },
      ],
    });
    const service = {
      '@type': 'Service',
      name: p.crumb,
      serviceType: PAGES[slug].serviceType,
      description: p.description,
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed: ['EG', 'SA'],
      url,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: p.offerTitle,
        itemListElement: p.offers.map((o) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: o.t, description: o.d } })),
      },
    };
    graph.push(service);
    if (slug === 'training') {
      p.offers.slice(0, 5).forEach((o) =>
        graph.push({
          '@type': 'Course',
          name: o.t,
          description: o.d,
          inLanguage,
          provider: { '@id': `${SITE_URL}/#organization` },
        })
      );
    }
    graph.push(faqPage(p.faq));
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
