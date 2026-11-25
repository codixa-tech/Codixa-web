import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Trash2, ShieldAlert, Pencil, Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { forgetMedia } from '../data/idb.js';
import { CATEGORIES, CATEGORY_MAP, CURRENCIES, STATUSES, PAYMENT_METHODS } from '../config/categories.js';
import { SITE } from '../config/site.js';
import { date } from '../lib/format.js';
import { completeBilingual } from '../lib/translate.js';
import { ClientModal, PaymentModal } from './forms.jsx';
import DynamicFields from './DynamicFields.jsx';
import MediaManager from './MediaManager.jsx';
import ContractsTab from './Contracts.jsx';
import ReportsMenu from './ReportsMenu.jsx';
import { Empty, Field, Money, PaidBar, Switch, useConfirm } from './ui.jsx';

const blank = () => ({
  kind: 'project',
  category: 'web',
  title: { ar: '', en: '' },
  summary: { ar: '', en: '' },
  clientId: null,
  showClient: true,
  status: 'planning',
  progress: 0,
  featured: false,
  published: true,
  startDate: '',
  endDate: '',
  cost: 0,
  currency: SITE.currency,
  images: [],
  videos: [],
  details: {},
});

const TABS = ['basics', 'media', 'details', 'access', 'payments', 'contracts'];

export default function ProjectEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { t, pick, isRTL } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [tab, setTab] = useState('basics');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clientModal, setClientModal] = useState(false);
  const [translating, setTranslating] = useState(false);
  const { data: clients = [] } = useData(() => api.clients.list(), []);

  useEffect(() => {
    let alive = true;
    setTab('basics');
    if (isNew) {
      const b = blank();
      setDraft(b);
      setOriginal(null);
    } else {
      api.projects.get(id).then((p) => {
        if (!alive) return;
        if (!p) return navigate('/dashboard/projects', { replace: true });
        setDraft(p);
        setOriginal(p);
      });
    }
    return () => {
      alive = false;
    };
  }, [id, isNew, navigate]);

  const cat = CATEGORY_MAP[draft?.category];
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setL = (k, lang, v) => setDraft((d) => ({ ...d, [k]: { ...d[k], [lang]: v } }));

  const changeCategory = (key) => {
    const next = CATEGORY_MAP[key];
    setDraft((d) => {
      const keep = new Set(next.fields.map((f) => f.key));
      const details = Object.fromEntries(Object.entries(d.details || {}).filter(([k]) => keep.has(k)));
      return { ...d, category: key, kind: next.kind, details };
    });
  };

  // Fill whichever language is missing (name, description, bilingual detail fields) by machine translation.
  // Text the user typed is never overwritten.
  const autoTranslate = async (d, { silent } = {}) => {
    const out = { ...d, details: { ...(d.details || {}) } };
    let changed = false;
    let failed = false;
    const fill = async (val, assign) => {
      const hasAr = typeof val === 'object' ? val?.ar?.trim() : '';
      const hasEn = typeof val === 'object' ? val?.en?.trim() : (val || '').trim();
      if (!hasAr === !hasEn) return; // both empty or both filled
      try {
        assign(await completeBilingual(val));
        changed = true;
      } catch {
        failed = true;
      }
    };
    await fill(out.title, (v) => (out.title = v));
    await fill(out.summary, (v) => (out.summary = v));
    for (const f of cat.fields.filter((x) => x.i18n)) {
      if (out.details[f.key]) await fill(out.details[f.key], (v) => (out.details[f.key] = v));
    }
    if (!silent) {
      if (failed) toast(t('dash.editor.translateFail'), 'err');
      else if (changed) toast(t('dash.editor.translated'));
    }
    return { draft: out, changed, failed };
  };

  const translateNow = async () => {
    setTranslating(true);
    const r = await autoTranslate(draft);
    setDraft(r.draft);
    setTranslating(false);
  };

  const save = async () => {
    if (!draft.title.ar.trim() && !draft.title.en.trim()) {
      setTab('basics');
      setError(t('dash.editor.needTitle'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      const tr = await autoTranslate(draft, { silent: true });
      if (tr.failed) toast(t('dash.editor.translateFail'), 'err');
      const saved = await api.projects.save({ ...tr.draft, cost: Number(tr.draft.cost) || 0, progress: Number(tr.draft.progress) || 0 });
      // Media removed in this edit is deleted from storage only once the change is saved.
      if (original) {
        const keep = new Set([...saved.images, ...saved.videos].flatMap((m) => [m.src, m.thumb, m.poster]).filter(Boolean));
        [...(original.images || []), ...(original.videos || [])]
          .flatMap((m) => [m.src, m.thumb, m.poster])
          .filter((s) => s && !keep.has(s))
          .forEach(forgetMedia);
      }
      setOriginal(saved);
      setDraft(saved);
      toast(t('dash.editor.saved'));
      if (isNew) navigate(`/dashboard/projects/${saved.id}`, { replace: true });
    } catch (e) {
      toast(e.message === 'STORAGE_FULL' ? 'Browser storage is full' : t('contact.error'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm(t('dash.editor.deleteConfirm'), { okLabel: t('dash.editor.delete') });
    if (!ok) return;
    await api.projects.remove(id);
    toast(t('dash.editor.deleted'));
    navigate('/dashboard/projects');
  };

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(original), [draft, original]);

  if (!draft) return <p className="muted">{t('dash.common.loading')}</p>;
  const Back = isRTL ? ArrowRight : ArrowLeft;
  const hasSecrets = cat?.fields.some((f) => f.secret);

  return (
    <div className="editor">
      <div className="pagehead">
        <div>
          <Link to="/dashboard/projects" className="backlink">
            <Back size={16} /> {t('dash.editor.back')}
          </Link>
          <h1>{isNew ? t('dash.editor.newTitle') : pick(draft.title) || t('dash.editor.editTitle')}</h1>
        </div>
        <div className="pagehead__tools">
          <ReportsMenu projectId={draft.id} disabled={isNew} />
          {!isNew && (
            <button className="btn btn--sm btn--ghost btn--danger-ghost" onClick={remove}>
              <Trash2 size={16} /> {t('dash.editor.delete')}
            </button>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.filter((k) => k !== 'access' || hasSecrets).map((k) => (
          <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
            {t(`dash.editor.tabs.${k}`)}
            {k === 'media' && <span className="tabs__count num">{draft.images.length + draft.videos.length}</span>}
          </button>
        ))}
      </div>

      <div className="panel editor__panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'basics' && (
          <div className="dgrid">
            <Field label={t('dash.editor.category')}>
              {(fid) => (
                <select id={fid} value={draft.category} onChange={(e) => changeCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {pick(c.single)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('dash.editor.status')}>
              {(fid) => (
                <select id={fid} value={draft.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {pick(s)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="translate-row">
              <p>{t('dash.editor.translateHint')}</p>
              <button type="button" className="btn btn--sm btn--ghost dark-ghost" onClick={translateNow} disabled={translating}>
                <Languages size={16} /> {translating ? t('dash.editor.translating') : t('dash.editor.translate')}
              </button>
            </div>
            <Field label={t('dash.editor.titleAr')} error={error}>
              {(fid) => <input id={fid} dir="rtl" value={draft.title.ar} onChange={(e) => setL('title', 'ar', e.target.value)} />}
            </Field>
            <Field label={t('dash.editor.titleEn')}>{(fid) => <input id={fid} dir="ltr" value={draft.title.en} onChange={(e) => setL('title', 'en', e.target.value)} />}</Field>
            <Field label={t('dash.editor.summaryAr')}>{(fid) => <textarea id={fid} dir="rtl" rows={3} value={draft.summary.ar} onChange={(e) => setL('summary', 'ar', e.target.value)} />}</Field>
            <Field label={t('dash.editor.summaryEn')}>{(fid) => <textarea id={fid} dir="ltr" rows={3} value={draft.summary.en} onChange={(e) => setL('summary', 'en', e.target.value)} />}</Field>

            <Field label={t('dash.editor.client')}>
              {(fid) => (
                <div className="inline">
                  <select id={fid} value={draft.clientId || ''} onChange={(e) => set('clientId', e.target.value || null)}>
                    <option value="">{t('dash.editor.noClient')}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company ? `${c.company} — ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn--sm btn--ghost dark-ghost" onClick={() => setClientModal(true)}>
                    <Plus size={16} /> {t('dash.editor.newClient')}
                  </button>
                </div>
              )}
            </Field>
            <Field label={`${t('dash.editor.progress')} (${draft.progress || 0}%)`}>
              {(fid) => <input id={fid} type="range" min="0" max="100" step="5" value={draft.progress || 0} onChange={(e) => set('progress', Number(e.target.value))} />}
            </Field>

            <Field label={t('dash.editor.start')}>{(fid) => <input id={fid} type="date" value={draft.startDate || ''} onChange={(e) => set('startDate', e.target.value)} />}</Field>
            <Field label={t('dash.editor.end')}>{(fid) => <input id={fid} type="date" value={draft.endDate || ''} onChange={(e) => set('endDate', e.target.value)} />}</Field>

            <Field label={t('dash.editor.cost')}>
              {(fid) => (
                <div className="inline">
                  <input id={fid} type="number" min="0" step="0.01" inputMode="decimal" value={draft.cost ?? ''} onChange={(e) => set('cost', e.target.value)} dir="ltr" />
                  <select value={draft.currency} onChange={(e) => set('currency', e.target.value)} aria-label={t('dash.editor.currency')} className="inline__narrow">
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </Field>
            <div className="df">
              <span className="df__label">&nbsp;</span>
              <div className="switches">
                <Switch id="sw-pub" checked={draft.published} onChange={(v) => set('published', v)} label={t('dash.editor.published')} />
                <Switch id="sw-feat" checked={draft.featured} onChange={(v) => set('featured', v)} label={t('dash.editor.featured')} />
              </div>
            </div>
          </div>
        )}

        {tab === 'media' && <MediaManager images={draft.images} videos={draft.videos} onImages={(v) => set('images', v)} onVideos={(v) => set('videos', v)} />}

        {tab === 'details' && (
          <>
            <p className="muted small mb">{t('dash.editor.detailsHint')}</p>
            <DynamicFields fields={cat.fields} values={draft.details} onChange={(v) => set('details', v)} />
          </>
        )}

        {tab === 'access' && (
          <>
            <div className="notice">
              <ShieldAlert size={20} />
              <div>
                <p>{t('dash.editor.accessHint')}</p>
                <p className="muted small">{t('dash.editor.demoWarning')}</p>
              </div>
            </div>
            <DynamicFields fields={cat.fields} values={draft.details} onChange={(v) => set('details', v)} secret />
          </>
        )}

        {tab === 'payments' && (isNew ? <Empty>{t('dash.editor.saveFirst')}</Empty> : <ProjectPayments project={draft} />)}
        {tab === 'contracts' && (isNew ? <Empty>{t('dash.editor.saveFirst')}</Empty> : <ContractsTab project={draft} />)}
      </div>

      <div className={`savebar ${dirty ? 'is-dirty' : ''}`}>
        <button className="btn" onClick={save} disabled={saving || (!dirty && !isNew)}>
          {saving ? t('dash.editor.saving') : t('dash.editor.save')}
        </button>
      </div>

      <ClientModal open={clientModal} onClose={() => setClientModal(false)} onSaved={(c) => set('clientId', c.id)} />
    </div>
  );
}

function ProjectPayments({ project }) {
  const { t, pick, locale } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [modal, setModal] = useState({ open: false, payment: null });
  const { data: rows = [] } = useData(() => api.payments.list({ projectId: project.id }), [project.id]);
  const paid = rows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const cost = Number(project.cost) || 0;
  const remaining = cost - paid;

  const del = async (p) => {
    if (!(await confirm(t('dash.payments.removeConfirm'), { okLabel: t('dash.payments.remove') }))) return;
    await api.payments.remove(p.id);
    toast(t('dash.payments.removed'));
  };

  return (
    <div className="stack">
      <div className="paysum">
        <div>
          <p className="muted small">{t('dash.payments.total')}</p>
          <Money value={cost} currency={project.currency} className="paysum__v" />
        </div>
        <div>
          <p className="muted small">{t('dash.payments.paid')}</p>
          <Money value={paid} currency={project.currency} className="paysum__v is-clear" />
        </div>
        <div>
          <p className="muted small">{remaining < 0 ? t('dash.payments.overpaid') : t('dash.payments.remaining')}</p>
          <Money value={Math.abs(remaining)} currency={project.currency} className={`paysum__v ${remaining > 0 ? 'is-due' : remaining < 0 ? 'is-over' : 'is-clear'}`} />
        </div>
        <PaidBar cost={cost} paid={paid} />
      </div>

      <div className="sechead">
        <h3>{t('dash.payments.title')}</h3>
        <button className="btn btn--sm" onClick={() => setModal({ open: true, payment: null })}>
          <Plus size={16} /> {t('dash.payments.add')}
        </button>
      </div>

      {rows.length ? (
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('dash.payments.date')}</th>
                <th>{t('dash.payments.method')}</th>
                <th>{t('dash.payments.reference')}</th>
                <th>{t('dash.payments.note')}</th>
                <th className="end">{t('dash.payments.amount')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="num">{date(p.date, locale)}</td>
                  <td>{pick(PAYMENT_METHODS.find((m) => m.key === p.method)) || '—'}</td>
                  <td dir="ltr" className="num">
                    {p.reference || '—'}
                  </td>
                  <td>{p.note || '—'}</td>
                  <td className="end">
                    <Money value={p.amount} currency={project.currency} />
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
      <PaymentModal open={modal.open} payment={modal.payment} projectId={project.id} projects={[project]} onClose={() => setModal({ open: false, payment: null })} />
    </div>
  );
}
