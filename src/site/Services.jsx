import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import CategoryIcon from '../components/CategoryIcon.jsx';
import { Link } from 'react-router-dom';
import { pathFor } from '../seo/config.js';

const PAGE = { systems: 'software-development', web: 'software-development', mobile: 'software-development', desktop: 'software-development', erp: 'erpnext', ai: 'training' };

const ICON = { systems: 'systems', web: 'web', mobile: 'mobile', desktop: 'desktop', erp: 'erp', ai: 'robotics' };

export default function Services() {
  const { t, lang } = useI18n();
  const items = t('services.items');
  const [open, setOpen] = useState('systems');

  return (
    <section className="section services" id="services" aria-labelledby="services-title">
      <div className="container services__grid">
        <header className="services__head">
          <h2 id="services-title" className="h2">
            {t('services.title')}
          </h2>
          <p className="lead">{t('services.lead')}</p>
        </header>
        <ul className="services__list">
          {items.map((s) => {
            const isOpen = open === s.key;
            return (
              <li key={s.key} className={`svc ${isOpen ? 'is-open' : ''}`}>
                <h3>
                  <button className="svc__toggle" aria-expanded={isOpen} aria-controls={`svc-${s.key}`} onClick={() => setOpen(isOpen ? '' : s.key)}>
                    <span className="svc__icon">
                      <CategoryIcon name={ICON[s.key]} size={22} />
                    </span>
                    <span className="svc__title">{s.title}</span>
                    <Plus className="svc__plus" size={22} aria-hidden="true" />
                  </button>
                </h3>
                <div id={`svc-${s.key}`} className="svc__body" role="region" aria-label={s.title}>
                  <div className="svc__inner">
                    <p>{s.text}</p>
                    <div>
                      <p className="svc__label">{t('services.deliverables')}</p>
                      <ul className="svc__points">
                        {s.points.map((p) => (
                          <li key={p}>
                            <span className="diamond" />
                            {p}
                          </li>
                        ))}
                      </ul>
                      <Link className="svclink" to={pathFor(lang, PAGE[s.key])}>
                        {t('nav.learnMore')}: {s.title}
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
