import { useI18n } from '../i18n/I18nProvider.jsx';

export default function Process() {
  const { t, locale } = useI18n();
  return (
    <section className="section process" aria-labelledby="process-title">
      <div className="container">
        <h2 id="process-title" className="h2">
          {t('process.title')}
        </h2>
        <ol className="steps">
          {t('process.steps').map((s, i) => (
            <li key={s.title} className="step">
              <span className="step__node" aria-hidden="true">
                <span className="num">{new Intl.NumberFormat(locale).format(i + 1)}</span>
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
