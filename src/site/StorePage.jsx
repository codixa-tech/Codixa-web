import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { pathFor } from '../seo/config.js';
import { applyHead } from '../seo/Seo.jsx';
import { storeHead, storePath } from '../seo/storeHead.js';
import { Img } from '../components/Media.jsx';
import Nav from './Nav.jsx';
import Footer from './Footer.jsx';
import WhatsAppButton from './WhatsAppButton.jsx';
import { PriceTag } from './SystemPage.jsx';
import './site.css';
import './service.css';
import './store.css';

export default function StorePage({ lang }) {
  const { t, pick, setLang, isRTL } = useI18n();
  const { data: systems, loading } = useData(() => api.store.list(), []);
  const [cat, setCat] = useState('');

  useEffect(() => {
    setLang(lang);
    window.scrollTo(0, 0);
    applyHead(storeHead(lang));
  }, [lang, setLang]);

  const cats = useMemo(() => [...new Set((systems || []).map((s) => s.category))], [systems]);
  const shown = (systems || []).filter((s) => !cat || s.category === cat);
  const Crumb = isRTL ? ChevronLeft : ChevronRight;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const home = pathFor(lang);

  return (
    <>
      <Nav />
      <main id="main" className="store">
        <section className="svcp__hero store__hero" aria-labelledby="store-title">
          <div className="svcp__glow" aria-hidden="true" />
          <div className="container">
            <nav className="crumbs" aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link to={home}>Codixa</Link>
                  <Crumb size={14} aria-hidden="true" />
                </li>
                <li aria-current="page">{t('store.crumb')}</li>
              </ol>
            </nav>
            <h1 id="store-title" className="svcp__title store__title">
              {t('store.title')}
            </h1>
            <p className="svcp__lead">{t('store.lead')}</p>
            {cats.length > 1 && (
              <div className="store__filters" role="group" aria-label={t('store.filter')}>
                {['', ...cats].map((c) => (
                  <button key={c || 'all'} className={`chip ${cat === c ? 'is-on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
                    {c ? t(`store.categories.${c}`) : t('store.all')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="section store__list" aria-label={t('store.title')}>
          <div className="container">
            {loading && !systems ? (
              <ul className="sgrid" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="scard scard--ghost" />
                ))}
              </ul>
            ) : shown.length ? (
              <ul className="sgrid">
                {shown.map((s) => (
                  <li key={s.slug}>
                    <Link to={storePath(lang, s.slug)} className="scard">
                      <span className="scard__media">
                        {s.cover ? <Img src={s.cover.thumb || s.cover.src} w={s.cover.w} h={s.cover.h} alt="" /> : <span className="scard__placeholder" aria-hidden="true" />}
                        {s.featured && <span className="scard__badge">{t('store.featured')}</span>}
                      </span>
                      <span className="scard__body">
                        <span className="scard__cat">{t(`store.categories.${s.category}`)}</span>
                        <span className="scard__title">{pick(s.title)}</span>
                        {pick(s.tagline) && <span className="scard__tagline">{pick(s.tagline)}</span>}
                        {s.highlights?.length > 0 && (
                          <span className="scard__points">
                            {s.highlights.slice(0, 3).map((h, i) => (
                              <span key={i} className="scard__point">
                                <span className="diamond" aria-hidden="true" />
                                {pick(h)}
                              </span>
                            ))}
                          </span>
                        )}
                        <span className="scard__foot">
                          <PriceTag price={s.price} compact />
                          <span className="scard__more">
                            {t('store.details')} <Arrow size={16} aria-hidden="true" />
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="store__empty">
                <h2 className="h2">{t('store.emptyTitle')}</h2>
                <p className="lead">{t('store.emptyText')}</p>
                <Link className="btn" to={{ pathname: home, hash: '#contact' }}>
                  {t('store.customCta')}
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="svcp__cta" aria-labelledby="store-cta">
          <div className="container svcp__cta-inner">
            <div>
              <h2 id="store-cta" className="h2">
                {t('store.customTitle')}
              </h2>
              <p className="lead">{t('store.customText')}</p>
            </div>
            <Link className="btn btn--light" to={{ pathname: home, hash: '#contact' }}>
              {t('store.customCta')}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
