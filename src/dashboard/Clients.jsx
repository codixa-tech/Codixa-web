import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Mail, Phone } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { ClientModal } from './forms.jsx';
import { Empty, MoneyList, useConfirm } from './ui.jsx';

export default function Clients() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [modal, setModal] = useState({ open: false, client: null });
  const { data: rows = [] } = useData(() => api.clients.list({ q }), [q]);

  const del = async (c) => {
    if (!(await confirm(t('dash.clients.removeConfirm'), { okLabel: t('dash.clients.remove') }))) return;
    await api.clients.remove(c.id);
    toast(t('dash.clients.removed'));
  };

  const pick = (key) => Object.fromEntries(Object.entries(key || {}).map(([c, v]) => [c, v.cost]));
  const paid = (key) => Object.fromEntries(Object.entries(key || {}).map(([c, v]) => [c, v.paid]));

  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.clients.title')}</h1>
        <button className="btn btn--sm" onClick={() => setModal({ open: true, client: null })}>
          <Plus size={16} /> {t('dash.clients.add')}
        </button>
      </div>
      <div className="filters">
        <label className="search">
          <Search size={17} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dash.clients.search')} aria-label={t('dash.clients.search')} />
        </label>
      </div>
      {rows.length ? (
        <div className="tablewrap panel panel--flush">
          <table className="table">
            <thead>
              <tr>
                <th>{t('dash.clients.name')}</th>
                <th>{t('dash.clients.email')}</th>
                <th>{t('dash.clients.country')}</th>
                <th className="end">{t('dash.clients.projects')}</th>
                <th className="end">{t('dash.clients.total')}</th>
                <th className="end">{t('dash.clients.paid')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="prow__name">{c.name}</span>
                    {c.company && <span className="prow__meta">{c.company}</span>}
                  </td>
                  <td>
                    <span className="contactcell">
                      {c.email && (
                        <a href={`mailto:${c.email}`} dir="ltr">
                          <Mail size={14} /> {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone.replace(/\s/g, '')}`} dir="ltr">
                          <Phone size={14} /> {c.phone}
                        </a>
                      )}
                    </span>
                  </td>
                  <td>{c.country || '—'}</td>
                  <td className="end num">{c.projectsCount}</td>
                  <td className="end">
                    <MoneyList map={pick(c.totals)} />
                  </td>
                  <td className="end">
                    <MoneyList map={paid(c.totals)} />
                  </td>
                  <td className="end rowtools">
                    <button className="iconbtn" onClick={() => setModal({ open: true, client: c })} aria-label={t('dash.common.edit')}>
                      <Pencil size={16} />
                    </button>
                    <button className="iconbtn danger" onClick={() => del(c)} aria-label={t('dash.clients.remove')}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('dash.clients.empty')}</Empty>
      )}
      <ClientModal open={modal.open} client={modal.client} onClose={() => setModal({ open: false, client: null })} />
    </div>
  );
}
