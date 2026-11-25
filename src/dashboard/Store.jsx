import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ExternalLink, EyeOff, Info, Languages, Plus, Star, Trash2, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { completeBilingual } from '../lib/translate.js';
import { CURRENCIES } from '../config/categories.js';
import { Img } from '../components/Media.jsx';
import MediaManager from './MediaManager.jsx';
import { Empty, Field, Money, Switch, useConfirm } from './ui.jsx';

// The editor is heavy; load it only when the description tab opens.
const RichTextEditor = lazy(() => import('./RichTextEditor.jsx'));

export const SYSTEM_CATEGORIES = ['erp', 'management', 'ecommerce', 'education', 'healthcare', 'mobile', 'other'];

const blank = () => ({
  slug: '',
  category: 'management',
  title: { ar: '', en: '' },
  tagline: { ar: '', en: '' },
  description: { ar: '', en: '' },
  highlights: [],
  requirements: [],
  price: '',
  currency: 'EGP',
  priceNote: { ar: '', en: '' },
  demoUrl: '',
  published: false,
  featured: false,
  position: 0,
  images: [],
});

function ServerOnly() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.store.title')}</h1>
      </div>
      <div className="notice notice--info">
        <Info size={18} />
        <div>{t('dash.store.serverOnly')}</div>
      </div>
    </div>
  );
}

export function StoreList() {
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const { data: rows } = useData(() => (api.store.available ? api.store.admin.list() : Promise.resolve([])), []);
  if (!api.store.available) return <ServerOnly />;

  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.store.title')}</h1>
        <div className="pagehead__tools">
          <a className="btn btn--sm btn--ghost dark-ghost" href="/store" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} /> {t('dash.store.viewStore')}
          </a>
          <Link className="btn btn--sm" to="/dashboard/store/new">
            <Plus size={16} /> {t('dash.store.new')}
          </Link>
        </div>
      </div>
      {rows && !rows.length ? (
        <Empty
          action={
            <Link className="btn btn--sm" to="/dashboard/store/new">
              {t('dash.store.new')}
            </Link>
          }
        >
          {t('dash.store.empty')}
        </Empty>
      ) : (
        <div className="tablewrap panel panel--flush">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>{t('dash.store.cols.name')}</th>
                <th>{t('dash.store.cols.category')}</th>
                <th className="end">{t('dash.store.cols.price')}</th>
                <th className="end">{t('dash.store.cols.orders')}</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/dashboard/store/${s.id}`)} className="is-click">
                  <td>
                    <div className="prow">
                      <span className="prow__thumb">{s.images?.[0] ? <Img src={s.images[0].thumb || s.images[0].src} w={64} h={40} alt="" /> : null}</span>
                      <span>
                        <Link to={`/dashboard/store/${s.id}`} className="prow__name" onClick={(e) => e.stopPropagation()}>
                          {pick(s.title) || '—'}
                        </Link>
                        <span className="prow__meta">
                          <span dir="ltr">/store/{s.slug}</span>
                          {s.featured && <Star size={13} className="prow__star" aria-label={t('dash.store.featured')} />}
                          {!s.published && (
                            <span className="prow__draft">
                              <EyeOff size={13} /> {t('dash.store.hidden')}
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>{t(`store.categories.${s.category}`)}</td>
                  <td className="end">{s.price.amount != null ? <Money value={s.price.amount} currency={s.price.currency} /> : <span className="muted">{t('store.onRequest')}</span>}</td>
                  <td className="end num">{s.ordersCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TABS = ['basics', 'description', 'features', 'media'];

export function SystemEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { t, pick, isRTL } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [tab, setTab] = useState('basics');
  const [descLang, setDescLang] = useState('ar');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!api.store.available) return;
    let alive = true;
    setTab('basics');
    if (isNew) {
      setDraft(blank());
      setOriginal(null);
    } else {
      api.store.admin.get(id).then((s) => {
        if (!alive) return;
        if (!s) return navigate('/dashboard/store', { replace: true });
        const d = { ...s, price: s.price.amount ?? '', currency: s.price.currency, priceNote: s.price.note };
        setDraft(d);
        setOriginal(d);
      });
    }
    return () => {
      alive = false;
    };
  }, [id, isNew, navigate]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(original), [draft, original]);
  if (!api.store.available) return <ServerOnly />;
  if (!draft) return <p className="muted">{t('dash.common.loading')}</p>;

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setL = (k, lang, v) => setDraft((d) => ({ ...d, [k]: { ...d[k], [lang]: v } }));

  // Fill a missing language in the short texts (title, tagline, price note, features, requirements).
  const translateShort = async (d) => {
    const out = { ...d };
    let failed = false;
    const fill = async (v) => {
      if (!v?.ar?.trim() === !v?.en?.trim()) return v;
      try {
        return await completeBilingual(v);
      } catch {
        failed = true;
        return v;
      }
    };
    out.title = await fill(out.title);
    out.tagline = await fill(out.tagline);
    out.priceNote = await fill(out.priceNote);
    out.highlights = await Promise.all(out.highlights.map(fill));
    out.requirements = await Promise.all(out.requirements.map(fill));
    return { draft: out, failed };
  };

  const translateNow = async () => {
    const r = await translateShort(draft);
    setDraft(r.draft);
    toast(r.failed ? t('dash.editor.translateFail') : t('dash.editor.translated'), r.failed ? 'err' : undefined);
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
      const tr = await translateShort(draft);
      const body = {
        ...tr.draft,
        price: tr.draft.price === '' || tr.draft.price == null ? null : Number(tr.draft.price),
        images: tr.draft.images.map((i) => ({ id: i.id })),
      };
      const saved = await api.store.admin.save(body);
      const d = { ...saved, price: saved.price.amount ?? '', currency: saved.price.currency, priceNote: saved.price.note };
      setDraft(d);
      setOriginal(d);
      toast(t('dash.editor.saved'));
      if (isNew) navigate(`/dashboard/store/${saved.id}`, { replace: true });
    } catch (e) {
      const fields = e.body?.detail && typeof e.body.detail === 'object' ? Object.keys(e.body.detail).join(', ') : '';
      toast(fields ? `${t('dash.store.invalid')}: ${fields}` : t('contact.error'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm(t('dash.store.deleteConfirm'), { okLabel: t('dash.editor.delete') }))) return;
    await api.store.admin.remove(id);
    toast(t('dash.editor.deleted'));
    navigate('/dashboard/store');
  };

  const Back = isRTL ? ArrowRight : ArrowLeft;
  const publicUrl = draft.slug ? `/store/${draft.slug}` : '';

  return (
    <div className="editor">
      <div className="pagehead">
        <div>
          <Link to="/dashboard/store" className="backlink">
            <Back size={16} /> {t('dash.store.back')}
          </Link>
          <h1>{isNew ? t('dash.store.newTitle') : pick(draft.title) || t('dash.store.editTitle')}</h1>
        </div>
        <div className="pagehead__tools">
          {!isNew && publicUrl && (
            <a className="btn btn--sm btn--ghost dark-ghost" href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> {t('dash.store.viewPage')}
            </a>
          )}
          {!isNew && (
            <button className="btn btn--sm btn--ghost btn--danger-ghost" onClick={remove}>
              <Trash2 size={16} /> {t('dash.editor.delete')}
            </button>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((k) => (
          <button key={k} role="tab" id={`stab-${k}`} aria-selected={tab === k} aria-controls={`spanel-${k}`} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
            {t(`dash.store.tabs.${k}`)}
            {k === 'media' && <span className="tabs__count num">{draft.images.length}</span>}
          </button>
        ))}
      </div>

      <div className="panel editor__panel" role="tabpanel" id={`spanel-${tab}`} aria-labelledby={`stab-${tab}`}>
        {tab === 'basics' && (
          <div className="dgrid">
            <Field label={t('dash.store.category')}>
              {(fid) => (
                <select id={fid} value={draft.category} onChange={(e) => set('category', e.target.value)}>
                  {SYSTEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`store.categories.${c}`)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('dash.store.slug')} hint={t('dash.store.slugHint')}>
              {(fid) => <input id={fid} dir="ltr" value={draft.slug} placeholder="clinic-manager" onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />}
            </Field>
            <div className="translate-row">
              <p>{t('dash.store.translateHint')}</p>
              <button type="button" className="btn btn--sm btn--ghost dark-ghost" onClick={translateNow}>
                <Languages size={16} /> {t('dash.editor.translate')}
              </button>
            </div>
            <Field label={t('dash.editor.titleAr')} error={error}>
              {(fid) => <input id={fid} dir="rtl" value={draft.title.ar} onChange={(e) => setL('title', 'ar', e.target.value)} />}
            </Field>
            <Field label={t('dash.editor.titleEn')}>{(fid) => <input id={fid} dir="ltr" value={draft.title.en} onChange={(e) => setL('title', 'en', e.target.value)} />}</Field>
            <Field label={t('dash.store.taglineAr')} hint={t('dash.store.taglineHint')}>
              {(fid) => <input id={fid} dir="rtl" maxLength={240} value={draft.tagline.ar} onChange={(e) => setL('tagline', 'ar', e.target.value)} />}
            </Field>
            <Field label={t('dash.store.taglineEn')}>{(fid) => <input id={fid} dir="ltr" maxLength={240} value={draft.tagline.en} onChange={(e) => setL('tagline', 'en', e.target.value)} />}</Field>
            <Field label={t('dash.store.price')} hint={t('dash.store.priceHint')}>
              {(fid) => (
                <div className="inline">
                  <input id={fid} type="number" min="0" step="0.01" inputMode="decimal" dir="ltr" value={draft.price ?? ''} onChange={(e) => set('price', e.target.value)} />
                  <select value={draft.currency} onChange={(e) => set('currency', e.target.value)} aria-label={t('dash.editor.currency')} className="inline__narrow">
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </Field>
            <Field label={t('dash.store.demoUrl')}>{(fid) => <input id={fid} dir="ltr" type="url" placeholder="https://" value={draft.demoUrl} onChange={(e) => set('demoUrl', e.target.value)} />}</Field>
            <Field label={t('dash.store.priceNoteAr')} hint={t('dash.store.priceNoteHint')}>
              {(fid) => <input id={fid} dir="rtl" value={draft.priceNote.ar} onChange={(e) => setL('priceNote', 'ar', e.target.value)} />}
            </Field>
            <Field label={t('dash.store.priceNoteEn')}>{(fid) => <input id={fid} dir="ltr" value={draft.priceNote.en} onChange={(e) => setL('priceNote', 'en', e.target.value)} />}</Field>
            <Field label={t('dash.store.position')} hint={t('dash.store.positionHint')}>
              {(fid) => <input id={fid} type="number" min="0" dir="ltr" value={draft.position} onChange={(e) => set('position', Number(e.target.value) || 0)} />}
            </Field>
            <div className="df">
              <span className="df__label">&nbsp;</span>
              <div className="switches">
                <Switch id="ss-pub" checked={draft.published} onChange={(v) => set('published', v)} label={t('dash.store.published')} />
                <Switch id="ss-feat" checked={draft.featured} onChange={(v) => set('featured', v)} label={t('dash.store.featured')} />
              </div>
            </div>
          </div>
        )}

        {tab === 'description' && (
          <div className="stack">
            <div className="seg seg--sm" role="group" aria-label={t('dash.store.descLang')}>
              {['ar', 'en'].map((l) => (
                <button key={l} type="button" className={descLang === l ? 'is-on' : ''} aria-pressed={descLang === l} onClick={() => setDescLang(l)}>
                  {l === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
            <p className="muted small">{t('dash.store.descHint')}</p>
            <Suspense fallback={<p className="muted">{t('dash.common.loading')}</p>}>
              <RichTextEditor
                key={`${draft.id || 'new'}-${descLang}`}
                id={`desc-${descLang}`}
                label={t(descLang === 'ar' ? 'dash.store.descAr' : 'dash.store.descEn')}
                dir={descLang === 'ar' ? 'rtl' : 'ltr'}
                value={draft.description[descLang]}
                placeholder={t('dash.store.descPlaceholder')}
                uploadImage={api.store.admin.uploadEditorImage}
                onChange={(html) => setL('description', descLang, html)}
              />
            </Suspense>
          </div>
        )}

        {tab === 'features' && (
          <div className="stack">
            <BilingualList title={t('dash.store.highlights')} hint={t('dash.store.highlightsHint')} rows={draft.highlights} onChange={(v) => set('highlights', v)} addLabel={t('dash.store.addHighlight')} />
            <BilingualList title={t('dash.store.requirements')} hint={t('dash.store.requirementsHint')} rows={draft.requirements} onChange={(v) => set('requirements', v)} addLabel={t('dash.store.addRequirement')} />
          </div>
        )}

        {tab === 'media' && <MediaManager images={draft.images} onImages={(v) => set('images', v)} upload={api.store.admin.uploadImage} />}
      </div>

      <div className={`savebar ${dirty ? 'is-dirty' : ''}`}>
        <button className="btn" onClick={save} disabled={saving || (!dirty && !isNew)}>
          {saving ? t('dash.editor.saving') : t('dash.store.save')}
        </button>
      </div>
    </div>
  );
}

function BilingualList({ title, hint, rows, onChange, addLabel }) {
  const { t } = useI18n();
  const update = (i, lang, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [lang]: v } : r)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <section className="blist">
      <div className="sechead">
        <div>
          <h3>{title}</h3>
          <p className="muted small">{hint}</p>
        </div>
        <button type="button" className="btn btn--sm btn--ghost dark-ghost" onClick={() => onChange([...rows, { ar: '', en: '' }])}>
          <Plus size={16} /> {addLabel}
        </button>
      </div>
      {rows.length > 0 && (
        <ol className="blist__rows">
          {rows.map((r, i) => (
            <li key={i} className="blist__row">
              <input dir="rtl" value={r.ar} placeholder="العربية" aria-label={`${title} ${i + 1} — العربية`} onChange={(e) => update(i, 'ar', e.target.value)} />
              <input dir="ltr" value={r.en} placeholder="English" aria-label={`${title} ${i + 1} — English`} onChange={(e) => update(i, 'en', e.target.value)} />
              <span className="blist__tools">
                <button type="button" className="iconbtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('dash.media.moveUp')}>
                  <ChevronUp size={16} />
                </button>
                <button type="button" className="iconbtn" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={t('dash.media.moveDown')}>
                  <ChevronDown size={16} />
                </button>
                <button type="button" className="iconbtn danger" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={t('dash.media.remove')}>
                  <X size={16} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
