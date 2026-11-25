import { useI18n } from '../i18n/I18nProvider.jsx';
import { Field, SecretInput, Switch, TagInput } from './ui.jsx';
import { optLabel, optValue } from '../config/categories.js';

/** Renders a category's schema fields. `secret` selects the credentials subset or the regular subset. */
export default function DynamicFields({ fields, values = {}, onChange, secret = false }) {
  const { t, pick, lang } = useI18n();
  const list = fields.filter((f) => !!f.secret === secret);
  const set = (key, v) => onChange({ ...values, [key]: v });

  return (
    <div className="dgrid">
      {list.map((f) => {
        const v = values[f.key];
        const wide = ['textarea', 'tags', 'multiselect'].includes(f.type);
        return (
          <Field key={f.key} label={pick(f.label)} tag={f.public ? t('dash.editor.publicTag') : null} wide={wide}>
            {(id) => {
              switch (f.type) {
                case 'textarea':
                  return <textarea id={id} rows={4} value={v || ''} onChange={(e) => set(f.key, e.target.value)} />;
                case 'number':
                  return <input id={id} type="number" inputMode="decimal" value={v ?? ''} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} placeholder={f.placeholder} dir="ltr" />;
                case 'date':
                  return <input id={id} type="date" value={v || ''} onChange={(e) => set(f.key, e.target.value)} />;
                case 'url':
                  return <input id={id} type="url" value={v || ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder || 'https://'} dir="ltr" />;
                case 'select':
                  return (
                    <select id={id} value={v || ''} onChange={(e) => set(f.key, e.target.value)}>
                      <option value="">{t('dash.editor.select')}</option>
                      {f.options.map((o) => (
                        <option key={optValue(o)} value={optValue(o)}>
                          {optLabel(f, optValue(o), lang)}
                        </option>
                      ))}
                    </select>
                  );
                case 'multiselect': {
                  const arr = Array.isArray(v) ? v : [];
                  return (
                    <div className="checks" id={id} role="group">
                      {f.options.map((opt) => {
                        const o = optValue(opt);
                        return (
                          <label key={o} className={`checkchip ${arr.includes(o) ? 'is-on' : ''}`}>
                            <input type="checkbox" checked={arr.includes(o)} onChange={(e) => set(f.key, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />
                            {optLabel(f, o, lang)}
                          </label>
                        );
                      })}
                    </div>
                  );
                }
                case 'tags':
                  return <TagInput id={id} value={Array.isArray(v) ? v : []} onChange={(arr) => set(f.key, arr)} placeholder={f.placeholder} />;
                case 'bool':
                  return <Switch id={id} checked={!!v} onChange={(b) => set(f.key, b)} label={v ? t('dash.editor.yes') : t('dash.editor.no')} />;
                case 'secret':
                  return <SecretInput id={id} value={v || ''} onChange={(x) => set(f.key, x)} placeholder={f.placeholder} />;
                default:
                  if (f.i18n) {
                    const bv = typeof v === 'string' ? { ar: '', en: v } : v || { ar: '', en: '' };
                    return (
                      <div className="pair">
                        <input id={id} dir="rtl" placeholder="عربي" value={bv.ar || ''} onChange={(e) => set(f.key, { ...bv, ar: e.target.value })} />
                        <input dir="ltr" placeholder="English" aria-label={`${pick(f.label)} (English)`} value={bv.en || ''} onChange={(e) => set(f.key, { ...bv, en: e.target.value })} />
                      </div>
                    );
                  }
                  return <input id={id} value={v || ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} dir={f.secret ? 'ltr' : undefined} />;
              }
            }}
          </Field>
        );
      })}
    </div>
  );
}
