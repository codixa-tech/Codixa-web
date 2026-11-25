import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { CATEGORY_MAP } from '../config/categories.js';
import { LogoMark } from '../components/Logo.jsx';
import { Img } from '../components/Media.jsx';

const SLIDE_MS = 5500;

export default function Hero({ introDone, onOpen }) {
  const { t } = useI18n();
  const activities = t('hero.activities');
  const { data: all = [] } = useData(() => api.projects.list({ publishedOnly: true }), []);
  // Featured work with images feeds the showcase; fall back to any published work with images.
  const items = useMemo(() => {
    const withImg = all.filter((p) => p.images?.length);
    const featured = withImg.filter((p) => p.featured);
    return (featured.length >= 2 ? featured : withImg).slice(0, 6);
  }, [all]);

  return (
    <section className={`hero ${introDone ? 'is-in' : ''}`} id="top" aria-labelledby="hero-title">
      <div className="hero__pattern" aria-hidden="true" />
      <div className="container hero__inner">
        <div className="hero__copy">
          <h1 id="hero-title" className="hero__title">
            {t('hero.title')}
          </h1>
          <p className="hero__lead">{t('hero.lead')}</p>
          <div className="hero__actions">
            <a className="btn" href="#contact">
              {t('hero.primary')}
            </a>
            <a className="btn btn--ghost" href="#work">
              {t('hero.secondary')}
            </a>
          </div>
        </div>
        <Showcase items={items} onOpen={onOpen} active={introDone} />
      </div>
      <div className="hero__strip" aria-label={t('hero.activitiesLabel')}>
        <div className="marquee">
          {[0, 1].map((copy) => (
            <ul key={copy} className="marquee__track" aria-hidden={copy === 1 || undefined}>
              {activities.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase({ items, onOpen, active }) {
  const { t, pick } = useI18n();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const n = items.length;

  useEffect(() => {
    if (i >= n) setI(0);
  }, [n, i]);

  useEffect(() => {
    if (!active || paused || n < 2 || reduced.current) return;
    const id = setTimeout(() => setI((x) => (x + 1) % n), SLIDE_MS);
    return () => clearTimeout(id);
  }, [i, n, paused, active]);

  const cur = items[i];
  const next = items[(i + 1) % n];

  return (
    <div className="show" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="show__glow" aria-hidden="true" />
      <div className="show__frame">
        {n ? (
          items.map((p, k) => (
            <button
              key={p.id}
              className={`show__slide ${k === i ? 'is-on' : ''}`}
              onClick={() => onOpen(p)}
              tabIndex={k === i ? 0 : -1}
              aria-hidden={k !== i}
              aria-label={`${pick(p.title)} — ${t('work.view')}`}
            >
              <Img src={p.images[0].src} w={p.images[0].w} h={p.images[0].h} alt="" eager={k === 0} />
            </button>
          ))
        ) : (
          <div className="show__empty" />
        )}
        {cur && (
          <div className="show__caption" aria-live="polite">
            <span className="show__cat">{pick(CATEGORY_MAP[cur.category]?.single)}</span>
            <span className="show__title">{pick(cur.title)}</span>
          </div>
        )}
      </div>

      {n > 1 && next && (
        <button className="show__peek" onClick={() => setI((i + 1) % n)} aria-label={t('work.next')}>
          <Img src={next.images[0].thumb || next.images[0].src} w={320} h={200} alt="" />
        </button>
      )}

      <div className="show__badge" aria-hidden="true">
        <LogoMark size={58} body="#fff" />
      </div>

      {n > 1 && (
        <div className="show__dots" role="tablist" aria-label={t('work.title')}>
          {items.map((p, k) => (
            <button key={p.id} role="tab" aria-selected={k === i} aria-label={pick(p.title)} className={k === i ? 'is-on' : ''} onClick={() => setI(k)}>
              <span style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused || !active ? 'paused' : 'running' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
