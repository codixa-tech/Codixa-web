import { Boxes, Wrench } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useSettings } from '../lib/useSettings.js';
import { Link } from 'react-router-dom';
import { pathFor } from '../seo/config.js';

export default function Enterprise() {
  const { t, lang } = useI18n();
  const site = useSettings();
  const blocks = [
    { key: 'frappe', Icon: Boxes },
    { key: 'maximo', Icon: Wrench },
  ];
  return (
    <section className="section enterprise" id="enterprise" aria-labelledby="ent-title">
      <div className="container">
        <header className="enterprise__head">
          <h2 id="ent-title" className="h2">
            {t('enterprise.title')}
          </h2>
          <p className="lead">{t('enterprise.lead')}</p>
        </header>
        <div className="enterprise__grid">
          {blocks.map(({ key, Icon }) => (
            <article key={key} className={`ent ent--${key}`}>
              <div className="ent__top">
                <span className="ent__icon">
                  <Icon size={26} strokeWidth={1.6} />
                </span>
                <h3 className="ent__name" dir="ltr">
                  {t(`enterprise.${key}.name`)}
                </h3>
              </div>
              <p className="ent__text">{t(`enterprise.${key}.text`)}</p>
              <ul className="ent__points">
                {t(`enterprise.${key}.points`).map((p) => (
                  <li key={p}>
                    <span className="diamond" />
                    {p}
                  </li>
                ))}
              </ul>
              <Link className="svclink" to={pathFor(lang, key === 'frappe' ? 'erpnext' : 'ibm-maximo')}>
                {t('nav.learnMore')}: {t(`enterprise.${key}.name`)}
              </Link>
              {key === 'maximo' && (
                <a className="partner" href={site.partnerUrl || undefined} target={site.partnerUrl ? '_blank' : undefined} rel="noopener noreferrer">
                  <span className="partner__label">{t('enterprise.maximo.partner')}</span>
                  <span className="partner__name" dir="ltr">
                    {site.partnerName}
                  </span>
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
