import { useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { number } from '../lib/format.js';
import './analytics.css';

const RANGES = [1, 7, 30, 90];
const VISITORS = '#2563eb';
const VIEWS = '#0891b2';

export default function Analytics() {
  const { t } = useI18n();
  const [days, setDays] = useState(30);
  const { data, loading } = useData(() => (api.analytics.available ? api.analytics.overview(days) : Promise.resolve(null)), [days]);

  if (!api.analytics.available) {
    return (
      <div className="stack">
        <div className="pagehead">
          <h1>{t('dash.analytics.title')}</h1>
        </div>
        <div className="notice notice--info">
          <Info size={18} />
          <div>{t('dash.analytics.serverOnly')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.analytics.title')}</h1>
        <div className="seg seg--sm" role="group" aria-label={t('dash.analytics.range')}>
          {RANGES.map((d) => (
            <button key={d} className={days === d ? 'is-on' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>
              {t(`dash.analytics.ranges.${d}`)}
            </button>
          ))}
        </div>
      </div>
      {!data ? (
        <p className="muted">{loading ? t('dash.common.loading') : t('contact.error')}</p>
      ) : (
        <Report data={data} days={days} />
      )}
    </div>
  );
}

function Report({ data, days }) {
  const { t, locale, pick } = useI18n();
  const n = (v) => number(v, locale);
  const tot = data.totals;
  const countryName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([locale], { type: 'region' });
      return (c) => dn.of(c) || c;
    } catch {
      return (c) => c;
    }
  }, [locale]);

  return (
    <>
      <div className="kpis">
        <Kpi label={t('dash.analytics.visitors')} value={n(tot.visitors)} change={tot.change.visitors} hint={t('dash.analytics.visitorsHint')} />
        <Kpi label={t('dash.analytics.views')} value={n(tot.views)} change={tot.change.views} />
        <Kpi label={t('dash.analytics.perVisitor')} value={n(tot.viewsPerVisitor)} />
        <Kpi label={t('dash.analytics.live')} value={n(tot.live)} live />
        <Kpi label={t('dash.analytics.orders')} value={n(tot.orders)} sub={`${n(tot.messages)} ${t('dash.analytics.messages')}`} />
      </div>

      <section className="panel">
        <div className="chead">
          <h2 className="panel__title">{t(days === 1 ? 'dash.analytics.byHour' : 'dash.analytics.byDay')}</h2>
          <div className="legend">
            <span className="legend__item">
              <span className="legend__swatch" style={{ background: VISITORS }} /> {t('dash.analytics.visitors')}
            </span>
            <span className="legend__item">
              <span className="legend__swatch legend__swatch--dash" style={{ borderColor: VIEWS }} /> {t('dash.analytics.views')}
            </span>
          </div>
        </div>
        <LineChart series={data.series} hourly={days === 1} />
      </section>

      <div className="agrid">
        <RankList title={t('dash.analytics.pages')} rows={data.pages} label={(k) => pageLabel(k, data.store, pick, t)} />
        <RankList title={t('dash.analytics.sources')} rows={data.sources} label={(k) => (k === 'direct' ? t('dash.analytics.direct') : k)} hint={t('dash.analytics.sourcesHint')} />
        <RankList title={t('dash.analytics.countries')} rows={data.countries} label={countryName} hint={t('dash.analytics.countriesHint')} />
        <RankList title={t('dash.analytics.devices')} rows={data.devices} label={(k) => t(`dash.analytics.device.${k}`)} />
      </div>

      <section className="panel">
        <h2 className="panel__title">{t('dash.analytics.store')}</h2>
        {data.store.length ? (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('dash.analytics.system')}</th>
                  <th className="end">{t('dash.analytics.visitors')}</th>
                  <th className="end">{t('dash.analytics.views')}</th>
                  <th className="end">{t('dash.analytics.orders')}</th>
                  <th className="end">{t('dash.analytics.conversion')}</th>
                </tr>
              </thead>
              <tbody>
                {data.store.map((s) => (
                  <tr key={s.slug}>
                    <td>
                      <a href={`/store/${s.slug}`} target="_blank" rel="noopener noreferrer">
                        {pick(s.title)}
                      </a>
                    </td>
                    <td className="end num">{n(s.visitors)}</td>
                    <td className="end num">{n(s.views)}</td>
                    <td className="end num">{n(s.orders)}</td>
                    <td className="end num">{s.visitors ? `${Math.round((s.orders * 1000) / s.visitors) / 10}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{t('dash.analytics.noStore')}</p>
        )}
      </section>
      <p className="muted small">{t('dash.analytics.privacy')}</p>
    </>
  );
}

function pageLabel(path, store, pick, t) {
  const p = <bdi dir="ltr" className="rank__path">{path}</bdi>;
  if (path === '/' || path === '/en') return <>{t('dash.analytics.home')} {p}</>;
  const m = path.match(/^\/(?:en\/)?store\/(.+)$/);
  if (m) {
    const s = store.find((x) => x.slug === m[1]);
    if (s) return <>{pick(s.title)} {p}</>;
  }
  return p;
}

function Kpi({ label, value, change, hint, sub, live }) {
  const { t } = useI18n();
  return (
    <div className="kpi panel">
      <p className="kpi__label">
        {live && <span className="kpi__dot" aria-hidden="true" />}
        {label}
      </p>
      <p className="kpi__value num">{value}</p>
      {change != null && (
        <p className={`kpi__change ${change >= 0 ? 'is-up' : 'is-down'}`}>
          <span aria-hidden="true">{change >= 0 ? '▲' : '▼'}</span> <span className="num">{Math.abs(change)}%</span> {t('dash.analytics.vsPrev')}
        </p>
      )}
      {sub && <p className="kpi__sub muted small">{sub}</p>}
      {hint && <p className="kpi__sub muted small">{hint}</p>}
      {live && <p className="kpi__sub muted small">{t('dash.analytics.liveHint')}</p>}
    </div>
  );
}

function RankList({ title, rows, label, hint, ltr }) {
  const { t, locale } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  return (
    <section className="panel">
      <h2 className="panel__title">{title}</h2>
      {hint && <p className="muted small">{hint}</p>}
      {rows.length ? (
        <ol className="rank">
          {rows.map((r) => (
            <li key={r.key} className="rank__row" title={`${number(r.visitors, locale)} ${t('dash.analytics.visitors')} · ${number(r.views, locale)} ${t('dash.analytics.views')}`}>
              <span className="rank__bar" style={{ width: `${(r.visitors / max) * 100}%` }} aria-hidden="true" />
              <span className="rank__label" dir={ltr ? 'ltr' : undefined}>
                {label(r.key)}
              </span>
              <span className="rank__value num">{number(r.visitors, locale)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">{t('dash.analytics.noData')}</p>
      )}
    </section>
  );
}

/** Two series on one count axis: visitors (solid + area) and page views (dashed). Hover shows both values. */
function LineChart({ series, hourly }) {
  const { t, locale, isRTL } = useI18n();
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 960;
  const H = 260;
  const pad = { t: 16, r: 16, b: 28, l: 44 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const maxV = Math.max(4, ...series.map((p) => Math.max(p.views, p.visitors)));
  const step = niceStep(maxV / 4);
  const top = Math.ceil(maxV / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const n = series.length;
  // Time runs right-to-left in Arabic, like the rest of the layout.
  const x = (i) => {
    const pos = n === 1 ? iw / 2 : (i / (n - 1)) * iw;
    return pad.l + (isRTL ? iw - pos : pos);
  };
  const y = (v) => pad.t + ih - (v / top) * ih;
  const line = (key) => series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const area = `${line('visitors')} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const fmtT = (p) =>
    hourly ? p.t : new Date(`${p.t}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  const onMove = (e) => {
    const box = ref.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    let dist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    }
    setHover(best);
  };

  const hp = hover != null ? series[hover] : null;
  return (
    <div className="lchart">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('dash.analytics.chartLabel')}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="lchart__grid" />
            <text x={isRTL ? W - pad.r + 4 : pad.l - 8} y={y(v) + 4} className="lchart__tick" textAnchor={isRTL ? 'start' : 'end'}>
              {number(v, locale)}
            </text>
          </g>
        ))}
        {series.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={p.t} x={x(i)} y={H - 8} className="lchart__tick" textAnchor="middle">
              {fmtT(p)}
            </text>
          ) : null
        )}
        <path d={area} fill={VISITORS} opacity="0.08" />
        <path d={line('views')} fill="none" stroke={VIEWS} strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={line('visitors')} fill="none" stroke={VISITORS} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hp && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="lchart__cross" />
            <circle cx={x(hover)} cy={y(hp.views)} r="4.5" fill={VIEWS} stroke="#fff" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(hp.visitors)} r="4.5" fill={VISITORS} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hp && (
        <div className="lchart__tip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
          <b>{fmtT(hp)}</b>
          <span>
            <i style={{ background: VISITORS }} /> {t('dash.analytics.visitors')}: <b className="num">{number(hp.visitors, locale)}</b>
          </span>
          <span>
            <i style={{ background: VIEWS }} /> {t('dash.analytics.views')}: <b className="num">{number(hp.views, locale)}</b>
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>{t('dash.analytics.chartLabel')}</caption>
        <tbody>
          {series.map((p) => (
            <tr key={p.t}>
              <th>{fmtT(p)}</th>
              <td>{p.visitors}</td>
              <td>{p.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}
