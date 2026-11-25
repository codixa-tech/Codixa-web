import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { LogoMark } from '../components/Logo.jsx';

export default function About() {
  const { t, locale } = useI18n();
  const { data: projects = [] } = useData(() => api.projects.list({ publishedOnly: true, kind: 'project' }), []);
  return (
    <section className="section about" id="about" aria-labelledby="about-title">
      <div className="container about__grid">
        <div className="about__mark" aria-hidden="true">
          <LogoMark size={220} body="var(--c-ink)" />
        </div>
        <div className="about__copy">
          <h2 id="about-title" className="h2">
            {t('about.title')}
          </h2>
          <p className="about__text">{t('about.text')}</p>
          <p className="about__founder">{t('about.founder')}</p>
          <dl className="stats">
            {t('about.stats').map((s) => (
              <div key={s.label} className="stat">
                <dt>{s.label}</dt>
                <dd className="num">{s.value}</dd>
              </div>
            ))}
            <div className="stat">
              <dt>{t('about.projectsLabel')}</dt>
              <dd className="num">{new Intl.NumberFormat(locale).format(projects.length)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
