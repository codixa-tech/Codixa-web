import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Star, EyeOff } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { CATEGORIES, STATUSES } from '../config/categories.js';
import { Img } from '../components/Media.jsx';
import CategoryIcon from '../components/CategoryIcon.jsx';
import { Empty, Money, PaidBar, StatusPill } from './ui.jsx';

export default function Projects() {
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const [f, setF] = useState({ q: '', category: '', status: '' });
  const { data: rows } = useData(() => api.projects.list(f), [f.q, f.category, f.status]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const filtered = f.q || f.category || f.status;

  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.projects.title')}</h1>
      </div>
      <div className="filters">
        <label className="search">
          <Search size={17} aria-hidden="true" />
          <input type="search" placeholder={t('dash.projects.search')} value={f.q} onChange={set('q')} aria-label={t('dash.projects.search')} />
        </label>
        <select value={f.category} onChange={set('category')} aria-label={t('dash.editor.category')}>
          <option value="">{t('dash.projects.allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {pick(c.label)}
            </option>
          ))}
        </select>
        <select value={f.status} onChange={set('status')} aria-label={t('dash.editor.status')}>
          <option value="">{t('dash.projects.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {pick(s)}
            </option>
          ))}
        </select>
      </div>

      {rows && !rows.length ? (
        <Empty
          action={
            !filtered && (
              <Link className="btn btn--sm" to="/dashboard/projects/new">
                {t('dash.projects.new')}
              </Link>
            )
          }
        >
          {filtered ? t('dash.projects.empty') : t('dash.projects.emptyAll')}
        </Empty>
      ) : (
        <div className="tablewrap panel panel--flush">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>{t('dash.projects.cols.name')}</th>
                <th>{t('dash.projects.cols.status')}</th>
                <th>{t('dash.projects.cols.client')}</th>
                <th className="end">{t('dash.projects.cols.cost')}</th>
                <th className="end">{t('dash.projects.cols.paid')}</th>
                <th className="end">{t('dash.projects.cols.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/dashboard/projects/${p.id}`)} className="is-click">
                  <td>
                    <div className="prow">
                      <span className="prow__thumb">{p.images?.[0] ? <Img src={p.images[0].thumb || p.images[0].src} w={64} h={40} alt="" /> : <CategoryIcon name={p.category} />}</span>
                      <span>
                        <Link to={`/dashboard/projects/${p.id}`} className="prow__name" onClick={(e) => e.stopPropagation()}>
                          {pick(p.title) || '—'}
                        </Link>
                        <span className="prow__meta">
                          <CategoryIcon name={p.category} size={14} />
                          {pick(CATEGORIES.find((c) => c.key === p.category)?.label)}
                          {p.featured && <Star size={13} className="prow__star" aria-label={t('dash.projects.featured')} />}
                          {!p.published && <EyeOff size={13} aria-label={t('dash.projects.draft')} />}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td>{p.client?.company || p.client?.name || <span className="muted">—</span>}</td>
                  <td className="end">{p.cost > 0 ? <Money value={p.cost} currency={p.currency} /> : <span className="muted">—</span>}</td>
                  <td className="end">
                    {p.cost > 0 ? (
                      <span className="paidcell">
                        <Money value={p.paid} currency={p.currency} />
                        <PaidBar cost={p.cost} paid={p.paid} />
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="end">{p.cost > 0 ? <Money value={p.remaining} currency={p.currency} className={p.remaining > 0 ? 'is-due' : p.remaining < 0 ? 'is-over' : 'is-clear'} /> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
