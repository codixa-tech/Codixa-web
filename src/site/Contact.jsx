import { useEffect, useState } from 'react';
import { Mail, MessageCircle, Phone, MapPin, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { api } from '../data/api.js';
import { useSettings, waLink, telLink } from '../lib/useSettings.js';

const EMPTY = { name: '', email: '', phone: '', service: '', message: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Contact({ preset }) {
  const { t, pick, lang } = useI18n();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const site = useSettings();

  useEffect(() => {
    if (preset) setForm((f) => ({ ...f, service: preset.service }));
  }, [preset]);

  const services = [...t('services.items').map((s) => ({ key: s.key, label: s.title })), { key: 'training', label: t('nav.training') }, { key: 'maximo', label: 'IBM Maximo' }, { key: 'other', label: t('contact.otherService') }];

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const validate = () => {
    const er = {};
    if (!form.name.trim()) er.name = t('contact.required');
    if (!form.email.trim()) er.email = t('contact.required');
    else if (!EMAIL_RE.test(form.email.trim())) er.email = t('contact.invalidEmail');
    if (!form.message.trim()) er.message = t('contact.required');
    return er;
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) {
      document.getElementById(`cf-${Object.keys(er)[0]}`)?.focus();
      return;
    }
    setState('sending');
    try {
      await api.messages.create({ ...form, lang });
      setState('sent');
      setForm(EMPTY);
    } catch {
      setState('error');
    }
  };

  const field = (k, label, props = {}, as = 'input') => {
    const Tag = as;
    return (
      <div className={`field ${errors[k] ? 'has-error' : ''}`}>
        <label htmlFor={`cf-${k}`}>{label}</label>
        <Tag id={`cf-${k}`} value={form[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `cf-${k}-err` : props['aria-describedby']} {...props} />
        {errors[k] && (
          <p className="field__error" id={`cf-${k}-err`}>
            {errors[k]}
          </p>
        )}
      </div>
    );
  };

  return (
    <section className="section contact" id="contact" aria-labelledby="contact-title">
      <div className="container contact__grid">
        <div className="contact__intro">
          <h2 id="contact-title" className="h2">
            {t('contact.title')}
          </h2>
          <p className="lead">{t('contact.lead')}</p>
          <p className="contact__direct-label">{t('contact.direct')}</p>
          <ul className="contact__direct">
            {site.email && (
              <li>
                <a href={`mailto:${site.email}`}>
                  <Mail size={20} /> <span dir="ltr">{site.email}</span>
                </a>
              </li>
            )}
            {site.whatsapp && (
              <li>
                <a href={waLink(site.whatsapp)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={20} /> {t('contact.whatsapp')} <span dir="ltr" className="muted-inline">{site.whatsapp}</span>
                </a>
              </li>
            )}
            {site.phone && (
              <li>
                <a href={telLink(site.phone)}>
                  <Phone size={20} /> <span dir="ltr">{site.phone}</span>
                </a>
              </li>
            )}
            {pick(site.address) && (
              <li>
                <span>
                  <MapPin size={20} /> {pick(site.address)}
                </span>
              </li>
            )}
          </ul>
        </div>

        <form className="form" onSubmit={submit} noValidate>
          {state === 'sent' ? (
            <div className="form__done" role="status">
              <CheckCircle2 size={36} />
              <p>{t('contact.sent')}</p>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setState('idle')}>
                {t('contact.send')}
              </button>
            </div>
          ) : (
            <>
              <div className="form__row">
                {field('name', t('contact.name'), { autoComplete: 'name', required: true })}
                {field('email', t('contact.email'), { type: 'email', autoComplete: 'email', required: true, dir: 'ltr' })}
              </div>
              <div className="form__row">
                {field('phone', t('contact.phone'), { type: 'tel', autoComplete: 'tel', dir: 'ltr' })}
                <div className="field">
                  <label htmlFor="cf-service">{t('contact.service')}</label>
                  <select id="cf-service" value={form.service} onChange={set('service')}>
                    <option value="">{t('contact.servicePick')}</option>
                    {services.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {field('message', t('contact.message'), { rows: 5, required: true, placeholder: t('contact.messageHint') }, 'textarea')}
              {state === 'error' && <p className="form__error">{t('contact.error')}</p>}
              <button className="btn form__submit" type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? t('contact.sending') : t('contact.send')}
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
