import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { PAYMENT_METHODS } from '../config/categories.js';
import { date } from '../lib/format.js';
import { PaymentModal } from './forms.jsx';
import { Empty, Money, MoneyList, useConfirm } from './ui.jsx';

export default function Payments() {
  const { t, pick, locale } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ projectId: '', clientId: '' });
  const [modal, setModal] = useState({ open: false, payment: null });
  const { data: rows = [] } = useData(() => api.payments.list(f), [f.projectId, f.clientId]);
  const { data: projects = [] } = useData(() => api.projects.list(), []);
  const { data: clients = [] } = useData(() => api.clients.list(), []);

  const totals = useMemo(() => {
    const m = {};
    rows.forEach((p) => {
      const c = p.project?.currency || '—';
      m[c] = (m[c] || 0) + Number(p.amount || 0);
    });
    return m;
  }, [rows]);

  const del = async (p) => {
    if (!(await confirm(t('dash.payments.removeConfirm'), { okLabel: t('dash.payments.remove') }))) return;
    await api.payments.remove(p.id);
    toast(t('dash.payments.removed'));
  };

  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.payments.title')}</h1>
        <button className="btn btn--sm" onClick={() => setModal({ open: true, payment: null })}>
          <Plus size={16} /> {t('dash.payments.add')}
        </button>
      </div>
      <div className="filters">
        <select value={f.projectId} onChange={(e) => setF((x) => ({ ...x, projectId: e.target.value }))} aria-label={t('dash.payments.project')}>
          <option value="">{t('dash.payments.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {pick(p.title)}
            </option>
          ))}
        </select>
        <select value={f.clientId} onChange={(e) => setF((x) => ({ ...x, clientId: e.target.value }))} aria-label={t('dash.payments.client')}>
          <option value="">{t('dash.clients.title')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company || c.name}
            </option>
          ))}
        </select>
        <p className="filters__total">
          {t('dash.payments.paid')}: <MoneyList map={totals} />
        </p>
      </div>

      {rows.length ? (
        <div className="tablewrap panel panel--flush">
          <table className="table">
            <thead>
              <tr>
                <th>{t('dash.payments.date')}</th>
                <th>{t('dash.payments.project')}</th>
                <th>{t('dash.payments.client')}</th>
                <th>{t('dash.payments.method')}</th>
                <th>{t('dash.payments.reference')}</th>
                <th className="end">{t('dash.payments.amount')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="num">{date(p.date, locale)}</td>
                  <td>{p.project ? <Link to={`/dashboard/projects/${p.project.id}`}>{pick(p.project.title)}</Link> : '—'}</td>
                  <td>{p.client?.name || '—'}</td>
                  <td>{pick(PAYMENT_METHODS.find((m) => m.key === p.method)) || '—'}</td>
                  <td dir="ltr" className="num">
                    {p.reference || '—'}
                  </td>
                  <td className="end">
                    <Money value={p.amount} currency={p.project?.currency} />
                  </td>
                  <td className="end rowtools">
                    <button className="iconbtn" onClick={() => setModal({ open: true, payment: p })} aria-label={t('dash.common.edit')}>
                      <Pencil size={16} />
                    </button>
                    <button className="iconbtn danger" onClick={() => del(p)} aria-label={t('dash.payments.remove')}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('dash.payments.empty')}</Empty>
      )}
      <PaymentModal open={modal.open} payment={modal.payment} projects={projects} projectId={modal.payment?.projectId} onClose={() => setModal({ open: false, payment: null })} />
    </div>
  );
}
