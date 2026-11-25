import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { date, money } from '../lib/format.js';
import { Empty, Money, PaidBar } from './ui.jsx';

export default function Overview() {
  const { t, pick, locale } = useI18n();
  const { data: s } = useData(() => api.stats.overview(), []);
  const { data: payments = [] } = useData(() => api.payments.list(), []);
  const currencies = useMemo(() => Object.keys(s?.byCurrency || {}), [s]);
  const [cur, setCur] = useState('');
  useEffect(() => {
    if (currencies.length && !currencies.includes(cur)) setCur(currencies[0]);
  }, [currencies, cur]);

  if (!s) return <p className="muted">{t('dash.common.loading')}</p>;
  const c = s.byCurrency[cur] || { contract: 0, received: 0, outstanding: 0, byMonth: {} };

  // last 12 months for the chart
  const months = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  const values = months.map((k) => c.byMonth[k] || 0);
  const max = Math.max(1, ...values);

  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.overview.title')}</h1>
        {currencies.length > 1 && (
          <div className="seg seg--sm" role="tablist">
            {currencies.map((x) => (
              <button key={x} role="tab" aria-selected={cur === x} className={cur === x ? 'is-on' : ''} onClick={() => setCur(x)}>
                {x}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="kpis">
        <Kpi label={t('dash.overview.contract')} value={<Money value={c.contract} currency={cur} />} />
        <Kpi label={t('dash.overview.received')} value={<Money value={c.received} currency={cur} />} tone="ok" />
        <Kpi label={t('dash.overview.outstanding')} value={<Money value={c.outstanding} currency={cur} />} tone="warn" />
        <Kpi label={t('dash.overview.active')} value={<span className="num">{s.active}</span>} sub={`${t('dash.overview.completed')}: ${s.completed}`} />
      </section>

      <div className="split">
        <section className="panel">
          <h2 className="panel__title">
            {t('dash.overview.revenue')} <span className="muted">({cur})</span>
          </h2>
          <div className="chart" role="img" aria-label={t('dash.overview.revenue')}>
            {values.map((v, i) => (
              <div key={months[i]} className="chart__col" title={`${months[i]}: ${money(v, cur, locale)}`}>
                <span className="chart__bar" style={{ height: `${(v / max) * 100}%` }} />
                <span className="chart__x">{date(`${months[i]}-01`, locale, { month: 'short' })}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="panel__title">{t('dash.overview.attention')}</h2>
          {s.attention.length ? (
            <ul className="attn">
              {s.attention.map((p) => (
                <li key={p.id}>
                  <Link to={`projects/${p.id}`}>
                    <span className="attn__name">{pick(p.title)}</span>
                    <Money value={p.remaining} currency={p.currency} className="attn__amt" />
                    <PaidBar cost={p.cost} paid={p.paid} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t('dash.overview.none')}</Empty>
          )}
        </section>
      </div>

      <section className="panel">
        <h2 className="panel__title">{t('dash.overview.recentPayments')}</h2>
        {payments.length ? (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('dash.payments.date')}</th>
                  <th>{t('dash.payments.project')}</th>
                  <th>{t('dash.payments.client')}</th>
                  <th className="end">{t('dash.payments.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td className="num">{date(p.date, locale)}</td>
                    <td>{p.project ? <Link to={`projects/${p.project.id}`}>{pick(p.project.title)}</Link> : '—'}</td>
                    <td>{p.client?.name || '—'}</td>
                    <td className="end">
                      <Money value={p.amount} currency={p.project?.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t('dash.payments.empty')}</Empty>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div className={`kpi ${tone ? `kpi--${tone}` : ''}`}>
      <p className="kpi__label">{label}</p>
      <p className="kpi__value">{value}</p>
      {sub && <p className="kpi__sub">{sub}</p>}
    </div>
  );
}
