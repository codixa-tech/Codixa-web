import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import Dialog from '../components/Dialog.jsx';
import { Img, Video } from '../components/Media.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { CATEGORY_MAP, optLabel } from '../config/categories.js';
import { number, yearOf } from '../lib/format.js';

export default function ProjectDialog({ project, onClose }) {
  const { t, pick, isRTL, locale, lang } = useI18n();
  const [index, setIndex] = useState(0);
  const images = project?.images || [];
  const total = images.length;
  const drag = useRef(null);

  useEffect(() => setIndex(0), [project?.id]);

  const go = useCallback((delta) => setIndex((i) => (total ? (i + delta + total) % total : 0)), [total]);

  useEffect(() => {
    if (!project) return;
    const onKey = (e) => {
      if (e.target.closest?.('input,textarea')) return;
      if (e.key === 'ArrowRight') go(isRTL ? -1 : 1);
      if (e.key === 'ArrowLeft') go(isRTL ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, go, isRTL]);

  if (!project) return null;
  const cat = CATEGORY_MAP[project.category];
  const fields = (cat?.fields || []).filter((f) => f.public && project.details?.[f.key] !== undefined);
  const live = project.details?.live_url;

  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, id: e.pointerId };
  };
  const onPointerUp = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    drag.current = null;
    if (Math.abs(dx) < 45) return;
    const forward = dx < 0; // swipe left
    go((forward ? 1 : -1) * (isRTL ? -1 : 1));
  };

  return (
    <Dialog open={!!project} onClose={onClose} labelledBy="pd-title" className="pd">
      <button className="pd__close" onClick={onClose} aria-label={t('work.close')} data-autofocus>
        <X size={22} />
      </button>
      <div className="pd__grid">
        <div className="pd__gallery">
          <div className="slider" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (drag.current = null)} aria-roledescription="carousel">
            <div className="slider__track" style={{ transform: `translateX(${(isRTL ? 1 : -1) * index * 100}%)` }}>
              {images.map((im, i) => (
                <div className="slider__slide" key={im.id} aria-hidden={i !== index} aria-roledescription="slide" aria-label={t('work.imageOf', { n: i + 1, total })}>
                  <Img src={im.src} w={im.w} h={im.h} alt={`${pick(project.title)} — ${i + 1}`} eager={i === 0} draggable="false" />
                </div>
              ))}
              {!total && <div className="slider__slide slider__empty" />}
            </div>
            {total > 1 && (
              <>
                <button className="slider__nav slider__nav--prev" onClick={() => go(-1)} aria-label={t('work.prev')}>
                  {isRTL ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
                </button>
                <button className="slider__nav slider__nav--next" onClick={() => go(1)} aria-label={t('work.next')}>
                  {isRTL ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
                </button>
                <span className="slider__counter num" aria-live="polite" dir="ltr">
                  {index + 1} / {total}
                </span>
              </>
            )}
          </div>
          {total > 1 && (
            <div className="thumbs" role="tablist">
              {images.map((im, i) => (
                <button key={im.id} role="tab" aria-selected={i === index} className={i === index ? 'is-on' : ''} onClick={() => setIndex(i)} aria-label={t('work.imageOf', { n: i + 1, total })}>
                  <Img src={im.thumb || im.src} w={160} h={100} alt="" />
                </button>
              ))}
            </div>
          )}
          {project.videos?.length > 0 && (
            <div className="pd__videos">
              {project.videos.map((v) => (
                <Video key={v.id} src={v.src} poster={v.poster} className={v.vertical ? 'is-vertical' : ''} />
              ))}
            </div>
          )}
        </div>

        <div className="pd__info">
          <p className="pd__cat">{pick(cat?.single)}</p>
          <h2 id="pd-title" className="pd__title">
            {pick(project.title)}
          </h2>
          <p className="pd__summary">{pick(project.summary)}</p>

          <dl className="pd__facts">
            {project.client && (
              <div>
                <dt>{t('work.client')}</dt>
                <dd>{project.client.name}</dd>
              </div>
            )}
            {yearOf(project) && (
              <div>
                <dt>{t('work.year')}</dt>
                <dd className="num">{yearOf(project)}</dd>
              </div>
            )}
            {fields
              .filter((f) => f.key !== 'live_url')
              .map((f) => (
                <div key={f.key} className={['tags', 'multiselect'].includes(f.type) ? 'is-wide' : ''}>
                  <dt>{pick(f.label)}</dt>
                  <dd>{renderValue(f, project.details[f.key], { t, locale, lang, pick })}</dd>
                </div>
              ))}
          </dl>

          {live && (
            <a className="btn pd__visit" href={live} target="_blank" rel="noopener noreferrer">
              {t('work.visit')}
              <ExternalLink size={18} />
            </a>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function renderValue(f, v, { t, locale, lang, pick }) {
  if (f.i18n || (v && typeof v === 'object' && !Array.isArray(v))) return pick(v);
  if (Array.isArray(v))
    return (
      <span className="tagrow">
        {v.map((x) => (
          <span key={x} className="tag">
            {optLabel(f, x, lang)}
          </span>
        ))}
      </span>
    );
  if (f.type === 'bool') return v ? t('work.yes') : t('work.no');
  if (f.type === 'number') return <span className="num">{number(v, locale)}</span>;
  if (f.type === 'url')
    return (
      <a href={v} target="_blank" rel="noopener noreferrer" className="link" dir="ltr">
        {String(v).replace(/^https?:\/\//, '')}
      </a>
    );
  if (f.type === 'select') return optLabel(f, v, lang);
  return String(v);
}
