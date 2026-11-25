import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Pencil, Plus, Trash2, Upload, Paperclip } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { CURRENCIES } from '../config/categories.js';
import { date } from '../lib/format.js';
import { Empty, Field, Modal, Money, useConfirm } from './ui.jsx';

const STATUS_TONE = { draft: 'planning', sent: 'in_progress', signed: 'completed', cancelled: 'on_hold' };

/** Contracts tab inside the project editor. */
export default function ContractsTab({ project }) {
  const { t, pick, locale } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // contract object or null
  const { data: rows = [] } = useData(() => api.contracts.list({ projectId: project.id }), [project.id]);
  const fileRef = useRef(null);
  const uploadFor = useRef(null);

  const startNew = async () => setEditing(await api.contracts.draft(project.id));

  const del = async (c) => {
    if (!(await confirm(t('dash.contracts.removeConfirm'), { okLabel: t('dash.contracts.remove') }))) return;
    await api.contracts.remove(c.id);
    toast(t('dash.contracts.removed'));
  };

  const pdf = async (c, lang) => {
    if (!api.reports.available) return toast(t('dash.reports.needsBackend'), 'err');
    try {
      toast(t('dash.reports.opening'));
      await api.contracts.openPdf(c.id, lang);
    } catch {
      toast(t('dash.reports.failed'), 'err');
    }
  };

  return (
    <div className="stack">
      <div className="sechead">
        <h3>{t('dash.contracts.title')}</h3>
        <button className="btn btn--sm" onClick={startNew}>
          <Plus size={16} /> {t('dash.contracts.new')}
        </button>
      </div>
      {!api.reports.available && <p className="notice notice--info">{t('dash.reports.needsBackend')}</p>}

      {rows.length ? (
        <ul className="ctrlist">
          {rows.map((c) => (
            <li key={c.id} className="ctr">
              <div className="ctr__main">
                <p className="ctr__no num" dir="ltr">
                  {c.number}
                </p>
                <p className="ctr__title">{pick(c.title)}</p>
                <p className="muted small">
                  <span className="num">{date(c.contractDate, locale)}</span> · <Money value={c.totalValue} currency={c.currency} />
                </p>
              </div>
              <span className={`pill pill--${STATUS_TONE[c.status] || 'planning'}`}>{t(`dash.contracts.statuses.${c.status}`)}</span>
              <div className="ctr__tools">
                <button className="btn btn--sm btn--ghost dark-ghost" onClick={() => pdf(c, 'ar')}>
                  <FileText size={15} /> {t('dash.contracts.pdfAr')}
                </button>
                <button className="btn btn--sm btn--ghost dark-ghost" onClick={() => pdf(c, 'en')}>
                  <FileText size={15} /> {t('dash.contracts.pdfEn')}
                </button>
                {api.reports.available && (
                  <button
                    className="iconbtn"
                    title={t('dash.contracts.uploadSigned')}
                    aria-label={t('dash.contracts.uploadSigned')}
                    onClick={() => {
                      uploadFor.current = c;
                      fileRef.current?.click();
                    }}
                  >
                    <Upload size={16} />
                  </button>
                )}
                {c.signedFile && (
                  <a className="iconbtn" href={c.signedFile} target="_blank" rel="noopener noreferrer" title={t('dash.contracts.signedCopy')} aria-label={t('dash.contracts.signedCopy')}>
                    <Paperclip size={16} />
                  </a>
                )}
                <button className="iconbtn" onClick={() => setEditing(c)} aria-label={t('dash.contracts.edit')}>
                  <Pencil size={16} />
                </button>
                <button className="iconbtn danger" onClick={() => del(c)} aria-label={t('dash.contracts.remove')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{t('dash.contracts.empty')}</Empty>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f && uploadFor.current) {
            await api.contracts.uploadSigned(uploadFor.current.id, f);
            toast(t('dash.contracts.saved'));
          }
        }}
      />
      <ContractModal contract={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ContractModal({ contract, onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setF(contract ? structuredClone(contract) : null);
    setError('');
  }, [contract]);

  const total = Number(f?.totalValue) || 0;
  const sum = useMemo(() => (f?.installments || []).reduce((s, i) => s + (Number(i.amount) || 0), 0), [f]);
  if (!f) return null;

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setPair = (k, lang) => (e) => setF((x) => ({ ...x, [k]: { ...(x[k] || {}), [lang]: e.target.value } }));
  const setNum = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value === '' ? '' : Number(e.target.value) }));

  const setTotal = (e) => {
    const v = e.target.value === '' ? '' : Number(e.target.value);
    setF((x) => ({ ...x, totalValue: v, installments: x.installments.map((i) => ({ ...i, amount: Math.round(((Number(v) || 0) * (Number(i.percent) || 0)) / 100 * 100) / 100 })) }));
  };
  const setInst = (idx, key, value) =>
    setF((x) => {
      const list = x.installments.map((i, n) => {
        if (n !== idx) return i;
        const next = { ...i, [key]: value };
        if (key === 'percent') next.amount = Math.round(((Number(x.totalValue) || 0) * (Number(value) || 0)) / 100 * 100) / 100;
        if (key === 'amount' && Number(x.totalValue)) next.percent = Math.round(((Number(value) || 0) / Number(x.totalValue)) * 10000) / 100;
        return next;
      });
      return { ...x, installments: list };
    });
  const setDel = (idx, lang, value) => setF((x) => ({ ...x, deliverables: x.deliverables.map((d, n) => (n === idx ? { ...d, [lang]: value } : d)) }));

  const save = async () => {
    if (!f.clientName?.trim()) return setError(t('dash.contracts.needName'));
    setBusy(true);
    try {
      await api.contracts.save({ ...f, totalValue: Number(f.totalValue) || 0, durationDays: f.durationDays === '' ? null : f.durationDays });
      toast(t('dash.contracts.saved'));
      onClose();
    } catch {
      toast(t('contact.error'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const STAT = ['draft', 'sent', 'signed', 'cancelled'];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={f.id ? `${t('dash.contracts.edit')} ${f.number}` : t('dash.contracts.new')}
      footer={
        <>
          <button className="btn btn--ghost btn--sm dark-ghost" onClick={onClose}>
            {t('dash.common.cancel')}
          </button>
          <button className="btn btn--sm" onClick={save} disabled={busy}>
            {t('dash.contracts.save')}
          </button>
        </>
      }
    >
      <div className="cform">
        <fieldset>
          <legend>{t('dash.contracts.sections.general')}</legend>
          <div className="dgrid">
            <Field label={t('dash.contracts.titleAr')}>{(id) => <input id={id} dir="rtl" value={f.title?.ar || ''} onChange={setPair('title', 'ar')} />}</Field>
            <Field label={t('dash.contracts.titleEn')}>{(id) => <input id={id} dir="ltr" value={f.title?.en || ''} onChange={setPair('title', 'en')} />}</Field>
            <Field label={t('dash.contracts.date')}>{(id) => <input id={id} type="date" value={f.contractDate || ''} onChange={set('contractDate')} />}</Field>
            <Field label={t('dash.contracts.status')}>
              {(id) => (
                <select id={id} value={f.status} onChange={set('status')}>
                  {STAT.map((s) => (
                    <option key={s} value={s}>
                      {t(`dash.contracts.statuses.${s}`)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('dash.contracts.start')}>{(id) => <input id={id} type="date" value={f.startDate || ''} onChange={set('startDate')} />}</Field>
            <Field label={t('dash.contracts.end')}>{(id) => <input id={id} type="date" value={f.endDate || ''} onChange={set('endDate')} />}</Field>
            <Field label={t('dash.contracts.duration')}>{(id) => <input id={id} type="number" min="0" value={f.durationDays ?? ''} onChange={setNum('durationDays')} dir="ltr" />}</Field>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('dash.contracts.sections.party')}</legend>
          <div className="dgrid">
            <Field label={t('dash.contracts.clientName')} error={error}>{(id) => <input id={id} value={f.clientName || ''} onChange={set('clientName')} />}</Field>
            <Field label={t('dash.contracts.clientCompany')}>{(id) => <input id={id} value={f.clientCompany || ''} onChange={set('clientCompany')} />}</Field>
            <Field label={t('dash.contracts.representative')}>{(id) => <input id={id} value={f.clientRepresentative || ''} onChange={set('clientRepresentative')} />}</Field>
            <Field label={t('dash.contracts.idNumber')}>{(id) => <input id={id} value={f.clientIdNumber || ''} onChange={set('clientIdNumber')} dir="ltr" />}</Field>
            <Field label={t('dash.contracts.address')} wide>{(id) => <input id={id} value={f.clientAddress || ''} onChange={set('clientAddress')} />}</Field>
            <Field label={t('dash.contracts.phone')}>{(id) => <input id={id} type="tel" value={f.clientPhone || ''} onChange={set('clientPhone')} dir="ltr" />}</Field>
            <Field label={t('dash.contracts.email')}>{(id) => <input id={id} type="email" value={f.clientEmail || ''} onChange={set('clientEmail')} dir="ltr" />}</Field>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('dash.contracts.sections.scope')}</legend>
          <div className="dgrid">
            <Field label={t('dash.contracts.scopeAr')}>{(id) => <textarea id={id} rows={4} dir="rtl" value={f.scope?.ar || ''} onChange={setPair('scope', 'ar')} />}</Field>
            <Field label={t('dash.contracts.scopeEn')}>{(id) => <textarea id={id} rows={4} dir="ltr" value={f.scope?.en || ''} onChange={setPair('scope', 'en')} />}</Field>
          </div>
          <p className="df__label mt">{t('dash.contracts.deliverables')}</p>
          <ul className="rows">
            {f.deliverables.map((d, i) => (
              <li key={i} className="rows__item">
                <input dir="rtl" placeholder="عربي" value={d.ar || ''} onChange={(e) => setDel(i, 'ar', e.target.value)} aria-label={`${t('dash.contracts.deliverables')} ${i + 1} (AR)`} />
                <input dir="ltr" placeholder="English" value={d.en || ''} onChange={(e) => setDel(i, 'en', e.target.value)} aria-label={`${t('dash.contracts.deliverables')} ${i + 1} (EN)`} />
                <button type="button" className="iconbtn danger" onClick={() => setF((x) => ({ ...x, deliverables: x.deliverables.filter((_, n) => n !== i) }))} aria-label={t('dash.contracts.remove1')}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--sm btn--ghost dark-ghost" onClick={() => setF((x) => ({ ...x, deliverables: [...x.deliverables, { ar: '', en: '' }] }))}>
            <Plus size={15} /> {t('dash.contracts.addDeliverable')}
          </button>
        </fieldset>

        <fieldset>
          <legend>{t('dash.contracts.sections.payment')}</legend>
          <div className="dgrid">
            <Field label={t('dash.contracts.value')}>
              {(id) => (
                <div className="inline">
                  <input id={id} type="number" min="0" step="0.01" value={f.totalValue ?? ''} onChange={setTotal} dir="ltr" />
                  <select value={f.currency} onChange={set('currency')} className="inline__narrow" aria-label="Currency">
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </Field>
          </div>
          <div className="insts" role="table" aria-label={t('dash.contracts.installments')}>
            <div className="insts__head" role="row">
              <span>{t('dash.contracts.labelAr')}</span>
              <span>{t('dash.contracts.labelEn')}</span>
              <span>{t('dash.contracts.percent')}</span>
              <span>{t('dash.contracts.amount')}</span>
              <span>{t('dash.contracts.due')}</span>
              <span />
            </div>
            {f.installments.map((i, n) => (
              <div className="insts__row" role="row" key={n}>
                <input dir="rtl" value={i.labelAr || ''} onChange={(e) => setInst(n, 'labelAr', e.target.value)} aria-label={t('dash.contracts.labelAr')} />
                <input dir="ltr" value={i.labelEn || ''} onChange={(e) => setInst(n, 'labelEn', e.target.value)} aria-label={t('dash.contracts.labelEn')} />
                <input type="number" min="0" max="100" step="0.01" value={i.percent ?? ''} onChange={(e) => setInst(n, 'percent', e.target.value)} dir="ltr" aria-label={t('dash.contracts.percent')} />
                <input type="number" min="0" step="0.01" value={i.amount ?? ''} onChange={(e) => setInst(n, 'amount', e.target.value)} dir="ltr" aria-label={t('dash.contracts.amount')} />
                <input type="date" value={i.due || ''} onChange={(e) => setInst(n, 'due', e.target.value)} aria-label={t('dash.contracts.due')} />
                <button type="button" className="iconbtn danger" onClick={() => setF((x) => ({ ...x, installments: x.installments.filter((_, k) => k !== n) }))} aria-label={t('dash.contracts.remove1')}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="insts__foot">
            <button
              type="button"
              className="btn btn--sm btn--ghost dark-ghost"
              onClick={() => setF((x) => ({ ...x, installments: [...x.installments, { labelAr: '', labelEn: '', percent: 0, amount: 0, due: '' }] }))}
            >
              <Plus size={15} /> {t('dash.contracts.addInstallment')}
            </button>
            <p className={`small ${Math.abs(sum - total) > 0.01 ? 'is-due' : 'is-clear'}`}>
              {t('dash.contracts.totalCheck', { sum: sum.toLocaleString('en-US'), total: total.toLocaleString('en-US'), pct: total ? Math.round((sum / total) * 100) : 0 })}
            </p>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('dash.contracts.sections.terms')}</legend>
          <div className="dgrid">
            <Field label={t('dash.contracts.warranty')}>{(id) => <input id={id} type="number" min="0" value={f.warrantyDays ?? ''} onChange={setNum('warrantyDays')} dir="ltr" />}</Field>
            <Field label={t('dash.contracts.support')}>{(id) => <input id={id} type="number" min="0" value={f.supportMonths ?? ''} onChange={setNum('supportMonths')} dir="ltr" />}</Field>
            <Field label={t('dash.contracts.obligationsAr')} hint={t('dash.contracts.obligationsHint')}>
              {(id) => <textarea id={id} rows={3} dir="rtl" value={f.clientObligations?.ar || ''} onChange={setPair('clientObligations', 'ar')} />}
            </Field>
            <Field label={t('dash.contracts.obligationsEn')} hint={t('dash.contracts.obligationsHint')}>
              {(id) => <textarea id={id} rows={3} dir="ltr" value={f.clientObligations?.en || ''} onChange={setPair('clientObligations', 'en')} />}
            </Field>
            <Field label={t('dash.contracts.extraAr')}>{(id) => <textarea id={id} rows={3} dir="rtl" value={f.extraTerms?.ar || ''} onChange={setPair('extraTerms', 'ar')} />}</Field>
            <Field label={t('dash.contracts.extraEn')}>{(id) => <textarea id={id} rows={3} dir="ltr" value={f.extraTerms?.en || ''} onChange={setPair('extraTerms', 'en')} />}</Field>
            <Field label={t('dash.contracts.notes')} wide>
              {(id) => <textarea id={id} rows={2} value={f.notes || ''} onChange={set('notes')} />}
            </Field>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
