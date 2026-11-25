import { Code2, BrainCircuit, Cpu, Globe, Wrench } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { Img } from '../components/Media.jsx';
import { Link } from 'react-router-dom';
import { pathFor } from '../seo/config.js';

const ICONS = { prog: Code2, ai: BrainCircuit, robotics: Cpu, web: Globe, maximo: Wrench };

export default function Training({ onShowWork, onPlan, onOpen }) {
  const { t, pick, lang } = useI18n();
  const { data: list = [] } = useData(() => api.projects.list({ publishedOnly: true, kind: 'training' }), []);
  const gallery = list.filter((p) => p.images?.length).slice(0, 3);
  return (
    <section className="section training" id="training" aria-labelledby="training-title">
      <div className="container training__grid">
        <header className="training__head">
          <h2 id="training-title" className="h2">
            {t('training.title')}
          </h2>
          <p className="lead">{t('training.lead')}</p>
          <div className="training__aud">
            <p className="training__aud-label">{t('training.audiences')}</p>
            <ul>
              {t('training.audienceList').map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
          <div className="training__actions">
            <button className="btn btn--light" onClick={onPlan}>
              {t('training.cta')}
            </button>
            <button className="btn btn--ghost" onClick={onShowWork}>
              {t('work.tabTraining')}
            </button>
          </div>
          <Link className="svclink" to={pathFor(lang, 'training')}>
            {t('nav.learnMore')}: {t('nav.training')}
          </Link>
        </header>
        <ul className="tracks" aria-label={t('training.tracksTitle')}>
          {t('training.tracks').map((tr) => {
            const Icon = ICONS[tr.key];
            return (
              <li key={tr.key} className="track">
                <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <h3>{tr.title}</h3>
                  <p>{tr.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {gallery.length > 0 && (
        <div className="container">
          <ul className="tgallery">
            {gallery.map((p) => (
              <li key={p.id}>
                <button className="tgallery__item" onClick={() => onOpen(p)} aria-label={`${pick(p.title)} — ${t('work.view')}`}>
                  <Img src={p.images[0].src} w={p.images[0].w} h={p.images[0].h} alt="" />
                  <span className="tgallery__cap">
                    <span className="tgallery__org">{pick(p.details?.organization)}</span>
                    <span className="tgallery__title">{pick(p.title)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
