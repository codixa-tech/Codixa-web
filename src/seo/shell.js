// Static, crawlable HTML for each public page, generated at build time.
// It mirrors the real page content (same text the React app renders) so search engines and
// link previews that do not execute JavaScript still read the full page. React replaces it on load.
import ar from '../i18n/ar.js';
import en from '../i18n/en.js';
import { PAGES, HOME_FAQ, FAQ_TITLE } from './pages.js';
import { SERVICE_SLUGS, pathFor } from './config.js';
import { SEED } from '../data/seed.js';

const DICT = { ar, en };
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const list = (items, fn) => `<ul>${items.map((x) => `<li>${fn(x)}</li>`).join('')}</ul>`;

function nav(lang, t) {
  const home = pathFor(lang);
  const other = lang === 'ar' ? 'en' : 'ar';
  const links = SERVICE_SLUGS.map((s) => `<a href="${pathFor(lang, s)}">${esc(PAGES[s][lang].crumb)}</a>`).join('');
  return `<header class="ss-nav"><a href="${home}" class="ss-brand">Codixa</a><nav aria-label="Main">${links}<a href="${home}#contact">${esc(t.nav.contact)}</a><a href="${pathFor(other)}" hreflang="${other}" lang="${other}">${esc(t.langSwitch)}</a></nav></header>`;
}

function footer(lang, t) {
  const s = SEED.settings;
  return `<footer class="ss-footer"><p>${esc(t.footer.tagline)}</p><p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a> · <a href="tel:${esc(s.phone)}">${esc(s.phone)}</a> · ${esc(s.address[lang])}</p><p>${esc(t.footer.partner)}: ${esc(s.partnerName)}</p><p>© Codixa</p></footer>`;
}

function faq(items, title) {
  return `<section><h2>${esc(title)}</h2>${items.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>`;
}

export function homeShell(lang) {
  const t = DICT[lang];
  const home = pathFor(lang);
  const svc = { systems: 'software-development', web: 'software-development', mobile: 'software-development', desktop: 'software-development', erp: 'erpnext', ai: 'training' };
  return [
    nav(lang, t),
    '<main>',
    `<section><h1>${esc(t.hero.title)}</h1><p>${esc(t.hero.lead)}</p><p><a href="${home}#contact">${esc(t.hero.primary)}</a></p>${list(t.hero.activities, esc)}</section>`,
    `<section id="services"><h2>${esc(t.services.title)}</h2><p>${esc(t.services.lead)}</p>${t.services.items
      .map((s) => `<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>${list(s.points, esc)}<p><a href="${pathFor(lang, svc[s.key])}">${esc(t.nav.learnMore)}: ${esc(s.title)}</a></p>`)
      .join('')}</section>`,
    `<section id="enterprise"><h2>${esc(t.enterprise.title)}</h2><p>${esc(t.enterprise.lead)}</p>${['frappe', 'maximo']
      .map((k) => `<h3>${esc(t.enterprise[k].name)}</h3><p>${esc(t.enterprise[k].text)}</p>${list(t.enterprise[k].points, esc)}<p><a href="${pathFor(lang, k === 'frappe' ? 'erpnext' : 'ibm-maximo')}">${esc(t.nav.learnMore)}: ${esc(t.enterprise[k].name)}</a></p>`)
      .join('')}<p>${esc(t.enterprise.maximo.partner)} Smart System</p></section>`,
    `<section id="training"><h2>${esc(t.training.title)}</h2><p>${esc(t.training.lead)}</p>${t.training.tracks.map((x) => `<h3>${esc(x.title)}</h3><p>${esc(x.text)}</p>`).join('')}<p><a href="${pathFor(lang, 'training')}">${esc(t.nav.learnMore)}: ${esc(t.nav.training)}</a></p></section>`,
    `<section><h2>${esc(t.process.title)}</h2><ol>${t.process.steps.map((s) => `<li><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')}</ol></section>`,
    `<section id="about"><h2>${esc(t.about.title)}</h2><p>${esc(t.about.text)}</p><p>${esc(t.about.founder)}</p>${list(t.about.stats, (s) => `${esc(s.value)} ${esc(s.label)}`)}</section>`,
    faq(HOME_FAQ[lang], FAQ_TITLE[lang]),
    `<section id="contact"><h2>${esc(t.contact.title)}</h2><p>${esc(t.contact.lead)}</p></section>`,
    '</main>',
    footer(lang, t),
  ].join('');
}

export function serviceShell(lang, slug) {
  const t = DICT[lang];
  const p = PAGES[slug][lang];
  const home = pathFor(lang);
  return [
    nav(lang, t),
    '<main>',
    `<nav aria-label="Breadcrumb"><a href="${home}">Codixa</a> › <span>${esc(p.crumb)}</span></nav>`,
    `<section><h1>${esc(p.h1)}</h1><p>${esc(p.lead)}</p><p><a href="${home}#contact">${esc(p.cta.button)}</a></p></section>`,
    `<section><h2>${esc(p.offerTitle)}</h2>${p.offers.map((o) => `<h3>${esc(o.t)}</h3><p>${esc(o.d)}</p>`).join('')}</section>`,
    `<section><h2>${esc(p.whyTitle)}</h2>${p.why.map((o) => `<h3>${esc(o.t)}</h3><p>${esc(o.d)}</p>`).join('')}</section>`,
    `<section><h2>${esc(t.process.title)}</h2><ol>${t.process.steps.map((s) => `<li><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')}</ol></section>`,
    faq(p.faq, p.faqTitle),
    `<section><h2>${esc(p.cta.title)}</h2><p>${esc(p.cta.text)}</p></section>`,
    `<nav aria-label="Services">${SERVICE_SLUGS.filter((s) => s !== slug)
      .map((s) => `<a href="${pathFor(lang, s)}">${esc(PAGES[s][lang].crumb)}</a>`)
      .join(' · ')}</nav>`,
    '</main>',
    footer(lang, t),
  ].join('');
}
