import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { PAGES } from '../seo/pages.js';
import { pathFor } from '../seo/config.js';
import Seo from '../seo/Seo.jsx';
import { useSettings, waLink } from '../lib/useSettings.js';
import { Img } from '../components/Media.jsx';
import CategoryIcon from '../components/CategoryIcon.jsx';
import Nav from './Nav.jsx';
import Process from './Process.jsx';
import Faq from './Faq.jsx';
import Footer from './Footer.jsx';
import ProjectDialog from './ProjectDialog.jsx';
import WhatsAppButton from './WhatsAppButton.jsx';
import './site.css';
import './service.css';

const ICON = { systems: 'systems', erp: 'erp', maximo: 'erp', training: 'training' };

export default function ServicePage({ lang, slug }) {
  const { t, pick, setLang, isRTL } = useI18n();
  const site = useSettings();
  const meta = PAGES[slug];
  const p = meta[lang];
  const [project, setProject] = useState(null);
  const { data: all = [] } = useData(() => api.projects.list({ publishedOnly: true }), []);

  useEffect(() => {
    setLang(lang);
    window.scrollTo(0, 0);
  }, [lang, slug, setLang]);

  const related = useMemo(() => {
    const r = meta.related;
    return all
      .filter((x) => x.kind === r.kind && x.images?.length)
      .filter((x) => !r.categories || r.categories.includes(x.category))
      .filter((x) => !r.tracks || r.tracks.includes(x.details?.track))
      .slice(0, 3);
  }, [all, meta]);

  const home = pathFor(lang);
  const Crumb = isRTL ? ChevronLeft : ChevronRight;

  return (
    <>
      <Seo lang={lang} slug={slug} />
      <Nav />
      <main id="main" className="svcp">
        <section className="svcp__hero" aria-labelledby="svcp-title">
          <div className="svcp__glow" aria-hidden="true" />
          <div className="container">
            <nav className="crumbs" aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link to={home}>Codixa</Link>
                  <Crumb size={14} aria-hidden="true" />
                </li>
                <li aria-current="page">{p.crumb}</li>
              </ol>
            </nav>
            <div className="svcp__head">
              <span className="svcp__icon" aria-hidden="true">
                <CategoryIcon name={ICON[meta.icon]} size={30} />
              </span>
              <h1 id="svcp-title" className="svcp__title">
                {p.h1}
              </h1>
            </div>
            <p className="svcp__lead">{p.lead}</p>
            <div className="hero__actions">
              <Link className="btn" to={{ pathname: home, hash: '#contact' }}>
                {p.cta.button}
              </Link>
              {site.whatsapp && (
                <a className="btn btn--ghost" href={waLink(site.whatsapp)} target="_blank" rel="noopener noreferrer">
                  {t('contact.whatsapp')}
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="section svcp__offers" aria-labelledby="offers-title">
          <div className="container">
            <h2 id="offers-title" className="h2">
              {p.offerTitle}
            </h2>
            <ul className="offers">
              {p.offers.map((o) => (
                <li key={o.t} className="offer">
                  <span className="offer__mark" aria-hidden="true" />
                  <h3>{o.t}</h3>
                  <p>{o.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {related.length > 0 && (
          <section className="section svcp__work" aria-labelledby="rel-title">
            <div className="container">
              <h2 id="rel-title" className="h2">
                {t('work.title')}
              </h2>
              <ul className="relgrid">
                {related.map((x) => (
                  <li key={x.id}>
                    <button className="tgallery__item" onClick={() => setProject(x)} aria-label={`${pick(x.title)} — ${t('work.view')}`}>
                      <Img src={x.images[0].src} w={x.images[0].w} h={x.images[0].h} alt={pick(x.title)} />
                      <span className="tgallery__cap">
                        <span className="tgallery__org">{pick(x.details?.organization) || ''}</span>
                        <span className="tgallery__title">{pick(x.title)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="section svcp__why" aria-labelledby="why-title">
          <div className="container">
            <h2 id="why-title" className="h2">
              {p.whyTitle}
            </h2>
            <ul className="why">
              {p.why.map((w) => (
                <li key={w.t}>
                  <Check size={22} aria-hidden="true" />
                  <h3>{w.t}</h3>
                  <p>{w.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Process />
        <Faq title={p.faqTitle} items={p.faq} />

        <section className="svcp__cta" aria-labelledby="cta-title">
          <div className="container svcp__cta-inner">
            <div>
              <h2 id="cta-title" className="h2">
                {p.cta.title}
              </h2>
              <p className="lead">{p.cta.text}</p>
            </div>
            <Link className="btn btn--light" to={{ pathname: home, hash: '#contact' }}>
              {p.cta.button}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <ProjectDialog project={project} onClose={() => setProject(null)} />
      <WhatsAppButton />
    </>
  );
}
