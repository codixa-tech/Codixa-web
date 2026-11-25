import { useEffect, useRef, useState } from 'react';
import { Mail, Share2, Handshake, FileSignature, Upload, Trash2, BellRing, Send, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../data/api.js';
import SocialIcon from '../components/SocialIcons.jsx';
import { Field, Switch } from './ui.jsx';

const SOCIAL = [
  ['linkedin', 'LinkedIn'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['x', 'X (Twitter)'],
  ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'],
  ['github', 'GitHub'],
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/\S+$/i;

export default function SiteSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const sigInput = useRef(null);
  const DOC_DEFAULTS = {
    companyName: { ar: 'كوديكسا للحلول التقنية', en: 'Codixa Technical Solutions' },
    ceoName: { ar: 'عبدالرحمن مصطفى', en: 'Abdulrahman Mustafa' },
    commercialReg: '',
    taxId: '',
    website: 'https://codixa.tech',
    signature: '',
  };

  useEffect(() => {
    api.settings.getAdmin().then((s) => setForm({ ...DOC_DEFAULTS, ...s }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await api.settings.testEmail();
      toast(t('dash.site.testSent', { to: r.to }));
    } catch (e) {
      toast(`${t('dash.site.testFailed')}: ${e.body?.error || e.message}`, 'err');
    } finally {
      setTesting(false);
    }
  };

  const uploadSignature = async (file) => {
    if (!file) return;
    const s = await api.settings.uploadSignature(file);
    setForm((f) => ({ ...f, signature: s.signature }));
    toast(t('dash.site.signatureSaved'));
  };
  const removeSignature = async () => {
    const s = await api.settings.removeSignature();
    setForm((f) => ({ ...f, signature: s.signature }));
    toast(t('dash.site.signatureSaved'));
  };

  if (!form) return <p className="muted">{t('dash.common.loading')}</p>;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setAddr = (lang) => (e) => setForm((f) => ({ ...f, address: { ...f.address, [lang]: e.target.value } }));
  const setPair = (k, lang) => (e) => setForm((f) => ({ ...f, [k]: { ...(f[k] || {}), [lang]: e.target.value } }));
  const setSocial = (k) => (e) => setForm((f) => ({ ...f, social: { ...f.social, [k]: e.target.value.trim() } }));

  const save = async (e) => {
    e.preventDefault();
    const er = {};
    if (form.email && !EMAIL_RE.test(form.email.trim())) er.email = t('dash.site.invalidEmail');
    SOCIAL.forEach(([k]) => {
      if (form.social?.[k] && !URL_RE.test(form.social[k])) er[`s_${k}`] = t('dash.site.invalidUrl');
    });
    if (form.partnerUrl && !URL_RE.test(form.partnerUrl)) er.partnerUrl = t('dash.site.invalidUrl');
    if (form.website && !URL_RE.test(form.website)) er.website = t('dash.site.invalidUrl');
    if (form.notifyEmail && !EMAIL_RE.test(form.notifyEmail.trim())) er.notifyEmail = t('dash.site.invalidEmail');
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const { signature, emailServer, ...data } = form;
    await api.settings.save({ ...data, email: (form.email || '').trim(), notifyEmail: (form.notifyEmail || '').trim() });
    setBusy(false);
    toast(t('dash.site.saved'));
  };

  return (
    <form className="stack editor" onSubmit={save} noValidate>
      <div className="pagehead">
        <h1>{t('dash.site.title')}</h1>
      </div>

      <section className="panel">
        <h2 className="panel__title iconed">
          <Mail size={18} /> {t('dash.site.contact')}
        </h2>
        <p className="muted small mb">{t('dash.site.contactHint')}</p>
        <div className="dgrid">
          <Field label={t('dash.site.email')} error={errors.email}>
            {(id) => <input id={id} type="email" dir="ltr" value={form.email || ''} onChange={set('email')} />}
          </Field>
          <Field label={t('dash.site.phone')}>{(id) => <input id={id} type="tel" dir="ltr" value={form.phone || ''} onChange={set('phone')} />}</Field>
          <Field label={t('dash.site.whatsapp')} hint={t('dash.site.whatsappHint')}>
            {(id) => <input id={id} type="tel" dir="ltr" value={form.whatsapp || ''} onChange={set('whatsapp')} />}
          </Field>
          <div />
          <Field label={t('dash.site.addressAr')}>{(id) => <input id={id} dir="rtl" value={form.address?.ar || ''} onChange={setAddr('ar')} />}</Field>
          <Field label={t('dash.site.addressEn')}>{(id) => <input id={id} dir="ltr" value={form.address?.en || ''} onChange={setAddr('en')} />}</Field>
        </div>
      </section>

      {form.emailServer && (
        <section className="panel">
          <h2 className="panel__title iconed">
            <BellRing size={18} /> {t('dash.site.notify')}
          </h2>
          <p className="muted small mb">{t('dash.site.notifyHint')}</p>
          {!form.emailServer.configured && (
            <div className="notice mb">
              <AlertTriangle size={18} />
              <div>{t('dash.site.smtpMissing')}</div>
            </div>
          )}
          <div className="dgrid">
            <Field label={t('dash.site.notifyEmail')} hint={t('dash.site.notifyEmailHint', { email: form.email || '' })} error={errors.notifyEmail}>
              {(id) => <input id={id} type="email" dir="ltr" placeholder={form.email || ''} value={form.notifyEmail || ''} onChange={set('notifyEmail')} />}
            </Field>
            <div className="df">
              <span className="df__label">&nbsp;</span>
              <div className="switches">
                <Switch id="nt-orders" checked={!!form.notifyOrders} onChange={(v) => setForm((f) => ({ ...f, notifyOrders: v }))} label={t('dash.site.notifyOrders')} />
                <Switch id="nt-msgs" checked={!!form.notifyMessages} onChange={(v) => setForm((f) => ({ ...f, notifyMessages: v }))} label={t('dash.site.notifyMessages')} />
              </div>
            </div>
          </div>
          <div className="inline mt">
            <button type="button" className="btn btn--sm btn--ghost dark-ghost" onClick={sendTest} disabled={testing}>
              <Send size={16} /> {testing ? t('dash.site.testing') : t('dash.site.sendTest')}
            </button>
            <span className="muted small" dir="ltr">
              {form.emailServer.configured ? form.emailServer.from : ''}
            </span>
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="panel__title iconed">
          <Share2 size={18} /> {t('dash.site.social')}
        </h2>
        <p className="muted small mb">{t('dash.site.socialHint')}</p>
        <div className="dgrid">
          {SOCIAL.map(([k, label]) => (
            <Field key={k} label={label} error={errors[`s_${k}`]}>
              {(id) => (
                <div className="withicon">
                  <SocialIcon name={k} size={16} />
                  <input id={id} type="url" dir="ltr" placeholder="https://" value={form.social?.[k] || ''} onChange={setSocial(k)} />
                </div>
              )}
            </Field>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title iconed">
          <Handshake size={18} /> {t('dash.site.partner')}
        </h2>
        <div className="dgrid">
          <Field label={t('dash.site.partnerName')}>{(id) => <input id={id} dir="ltr" value={form.partnerName || ''} onChange={set('partnerName')} />}</Field>
          <Field label={t('dash.site.partnerUrl')} error={errors.partnerUrl}>
            {(id) => <input id={id} type="url" dir="ltr" placeholder="https://" value={form.partnerUrl || ''} onChange={set('partnerUrl')} />}
          </Field>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title iconed">
          <FileSignature size={18} /> {t('dash.site.documents')}
        </h2>
        <p className="muted small mb">{t('dash.site.documentsHint')}</p>
        <div className="dgrid">
          <Field label={t('dash.site.companyAr')}>{(id) => <input id={id} dir="rtl" value={form.companyName?.ar || ''} onChange={setPair('companyName', 'ar')} />}</Field>
          <Field label={t('dash.site.companyEn')}>{(id) => <input id={id} dir="ltr" value={form.companyName?.en || ''} onChange={setPair('companyName', 'en')} />}</Field>
          <Field label={t('dash.site.ceoAr')}>{(id) => <input id={id} dir="rtl" value={form.ceoName?.ar || ''} onChange={setPair('ceoName', 'ar')} />}</Field>
          <Field label={t('dash.site.ceoEn')}>{(id) => <input id={id} dir="ltr" value={form.ceoName?.en || ''} onChange={setPair('ceoName', 'en')} />}</Field>
          <Field label={t('dash.site.commercialReg')}>{(id) => <input id={id} dir="ltr" value={form.commercialReg || ''} onChange={set('commercialReg')} />}</Field>
          <Field label={t('dash.site.taxId')}>{(id) => <input id={id} dir="ltr" value={form.taxId || ''} onChange={set('taxId')} />}</Field>
          <Field label={t('dash.site.website')} error={errors.website}>{(id) => <input id={id} type="url" dir="ltr" value={form.website || ''} onChange={set('website')} />}</Field>
        </div>
        <div className="sigbox">
          <div className="sigbox__preview">{form.signature ? <img src={form.signature} alt="" /> : <span dir="ltr">{form.ceoName?.en}</span>}</div>
          <div>
            <p className="df__label">{t('dash.site.signature')}</p>
            <p className="muted small">{api.reports.available ? t('dash.site.signatureHint') : t('dash.site.needsBackend')}</p>
            <div className="btnrow">
              <button type="button" className="btn btn--sm" disabled={!api.reports.available} onClick={() => sigInput.current?.click()}>
                <Upload size={15} /> {t('dash.site.uploadSignature')}
              </button>
              {form.signature && (
                <button type="button" className="btn btn--sm btn--ghost btn--danger-ghost" onClick={removeSignature}>
                  <Trash2 size={15} /> {t('dash.site.removeSignature')}
                </button>
              )}
            </div>
            <input
              ref={sigInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                uploadSignature(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </section>

      <div className="savebar is-static">
        <button className="btn" type="submit" disabled={busy}>
          {t('dash.site.save')}
        </button>
      </div>
    </form>
  );
}
