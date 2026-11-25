import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { CATEGORY_MAP, PROJECT_CATEGORIES, optLabel } from '../config/categories.js';
import { Img } from '../components/Media.jsx';
import CategoryIcon from '../components/CategoryIcon.jsx';
import { yearOf } from '../lib/format.js';

export default function Work({ onOpen, kind, setKind }) {
  const { t, pick, lang } = useI18n();
  const [filter, setFilter] = useState('');
  const { data: all = [] } = useData(() => api.projects.list({ publishedOnly: true }), []);

  const pool = useMemo(() => all.filter((p) => p.kind === kind), [all, kind]);

  const chips = useMemo(() => {
    if (kind === 'project') {
      return PROJECT_CATEGORIES.filter((c) => pool.some((p) => p.category === c.key)).map((c) => ({ key: c.key, label: pick(c.label), icon: c.key }));
    }
    const tracks = [...new Set(pool.map((p) => p.details?.track).filter(Boolean))];
    const trackField = CATEGORY_MAP.training.fields.find((f) => f.key === 'track');
    return tracks.map((tr) => ({ key: tr, label: optLabel(trackField, tr, lang) }));
  }, [kind, pool, pick, lang]);

  const shown = useMemo(
    () => pool.filter((p) => !filter || (kind === 'project' ? p.category === filter : p.details?.track === filter)),
    [pool, filter, kind]
  );

  // Native View Transitions morph the grid between filters (no animation library shipped).
  const transition = (fn) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduced) document.startViewTransition(() => flushSync(fn));
    else fn();
  };
  const switchKind = (k) =>
    transition(() => {
      setKind(k);
      setFilter('');
    });
  const pickFilter = (f) => transition(() => setFilter(f));

  return (
    <section className="section work" id="work" aria-labelledby="work-title">
      <div className="container">
        <header className="work__head">
          <div>
            <h2 id="work-title" className="h2">
              {t('work.title')}
            </h2>
            <p className="lead">{t('work.lead')}</p>
          </div>
          <div className="seg" role="tablist" aria-label={t('work.title')}>
            {['project', 'training'].map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'is-on' : ''} onClick={() => switchKind(k)}>
                {k === 'project' ? t('work.tabProjects') : t('work.tabTraining')}
                <span className="seg__count num">{all.filter((p) => p.kind === k).length}</span>
              </button>
            ))}
          </div>
        </header>

        {chips.length > 1 && (
          <div className="chips" role="group" aria-label={t('work.category')}>
            <button className={`chip ${!filter ? 'is-on' : ''}`} aria-pressed={!filter} onClick={() => pickFilter('')}>
              {t('work.all')}
            </button>
            {chips.map((c) => (
              <button key={c.key} className={`chip ${filter === c.key ? 'is-on' : ''}`} aria-pressed={filter === c.key} onClick={() => pickFilter(c.key)}>
                {c.icon && <CategoryIcon name={c.icon} size={16} />}
                {c.label}
              </button>
            ))}
          </div>
        )}

        <ul className="work__grid">
          {shown.map((p, i) => (
            <li key={p.id} className={`card ${p.featured && i === 0 ? 'card--wide' : ''}`} style={{ viewTransitionName: `card-${p.id}` }}>
              <ProjectCard p={p} onOpen={onOpen} />
            </li>
          ))}
        </ul>
        {!shown.length && <p className="work__empty">{t('work.empty')}</p>}
      </div>
    </section>
  );
}

function ProjectCard({ p, onOpen }) {
  const { t, pick, lang } = useI18n();
  const cat = CATEGORY_MAP[p.category];
  const [a, b] = p.images;
  const trackField = cat?.fields.find((f) => f.key === 'track');
  const meta = p.kind === 'training' ? pick(p.details?.organization) || optLabel(trackField, p.details?.track, lang) : pick(cat?.single);
  return (
    <button className="card__btn" onClick={() => onOpen(p)} aria-label={`${pick(p.title)} — ${t('work.view')}`}>
      <div className="card__media">
        {a ? <Img src={a.thumb || a.src} w={a.w} h={a.h} alt="" /> : <div className="card__ph" />}
        {b && <Img src={b.thumb || b.src} w={b.w} h={b.h} alt="" className="card__alt" />}
        {p.images.length > 1 && <span className="card__count num">{p.images.length}</span>}
      </div>
      <div className="card__body">
        <span className="card__meta">
          <CategoryIcon name={p.category} size={15} />
          {meta}
          {yearOf(p) && <span className="card__year num">{yearOf(p)}</span>}
        </span>
        <span className="card__title">{pick(p.title)}</span>
        <span className="card__summary">{pick(p.summary)}</span>
      </div>
    </button>
  );
}
