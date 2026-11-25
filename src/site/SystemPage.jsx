import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Server, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { pathFor } from '../seo/config.js';
import { applyHead } from '../seo/Seo.jsx';
import { storeHead, storePath } from '../seo/storeHead.js';
import { useSettings, waLink } from '../lib/useSettings.js';
import { money } from '../lib/format.js';
import { Img } from '../components/Media.jsx';
import Dialog from '../components/Dialog.jsx';
import Nav from './Nav.jsx';
import Footer from './Footer.jsx';
import NotFound from './NotFound.jsx';
import WhatsAppButton from './WhatsAppButton.jsx';
import '../styles/prose.css';
import './site.css';
import './service.css';
import './store.css';

export function PriceTag({ price, compact }) {
  const { t, pick, locale } = useI18n();
  if (!price || price.amount == null) return <span className="ptag ptag--ask">{t('store.onRequest')}</span>;
  const note = pick(price.note);
  return (
    <span className={`ptag ${compact ? 'ptag--compact' : ''}`}>
      {note && <span className="ptag__note">{note}</span>}
      <span className="ptag__amount num">{money(price.amount, price.currency, locale)}</span>
    </span>
  );
}

export default function SystemPage({ lang, slug }) {
  const { t, pick, setLang, isRTL } = useI18n();
  const site = useSettings();
  const { data: s, loading } = useData(() => api.store.get(slug), [slug]);
  const [booking, setBooking] = useState(false);
  const [shot, setShot] = useState(0);

  useEffect(() => {
    setLang(lang);
    window.scrollTo(0, 0);
  }, [lang, slug, setLang]);
  useEffect(() => {
    if (s) applyHead(storeHead(lang, s, pick));
  }, [s, lang, pick]);

  if (loading && !s) return <div className="page-boot" />;
  if (!s) return <NotFound />;

  const Crumb = isRTL ? ChevronLeft : ChevronRight;
  const home = pathFor(lang);
  const images = s.images || [];
  const current = images[shot] || images[0];
  const description = pick(s.description);

  return (
    <>
      <Nav />
      <main id="main" className="store sys">
        <section className="svcp__hero sys__hero" aria-labelledby="sys-title">
          <div className="svcp__glow" aria-hidden="true" />
          <div className="container sys__hero-grid">
            <div>
              <nav className="crumbs" aria-label="Breadcrumb">
                <ol>
                  <li>
                    <Link to={home}>Codixa</Link>
                    <Crumb size={14} aria-hidden="true" />
                  </li>
                  <li>
                    <Link to={storePath(lang)}>{t('store.crumb')}</Link>
                    <Crumb size={14} aria-hidden="true" />
                  </li>
                  <li aria-current="page">{pick(s.title)}</li>
                </ol>
              </nav>
              <p className="sys__cat">{t(`store.categories.${s.category}`)}</p>
              <h1 id="sys-title" className="svcp__title sys__title">
                {pick(s.title)}
              </h1>
              {pick(s.tagline) && <p className="svcp__lead">{pick(s.tagline)}</p>}
              <div className="hero__actions sys__actions">
                <button className="btn" onClick={() => setBooking(true)}>
                  {t('store.book')}
                </button>
                {s.demoUrl && (
                  <a className="btn btn--ghost" href={s.demoUrl} target="_blank" rel="noopener noreferrer">
                    {t('store.demo')} <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
            {current && (
              <figure className="sys__shot">
                <Img src={current.src} w={current.w} h={current.h} alt={pick(s.title)} eager sizes="(min-width: 960px) 560px, 100vw" />
              </figure>
            )}
          </div>
        </section>

        <div className="section sys__body">
          <div className="container sys__layout">
            <div className="sys__main">
              {images.length > 1 && (
                <ul className="sys__thumbs" aria-label={t('store.gallery')}>
                  {images.map((im, i) => (
                    <li key={im.id}>
                      <button className={i === shot ? 'is-on' : ''} aria-pressed={i === shot} aria-label={t('store.showImage', { n: i + 1 })} onClick={() => setShot(i)}>
                        <Img src={im.thumb || im.src} w={im.w} h={im.h} alt="" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {s.highlights?.length > 0 && (
                <section aria-labelledby="sys-feat">
                  <h2 id="sys-feat" className="sys__h2">
                    {t('store.features')}
                  </h2>
                  <ul className="sys__features">
                    {s.highlights.map((h, i) => (
                      <li key={i}>
                        <Check size={18} aria-hidden="true" />
                        <span>{pick(h)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {description && (
                <section aria-labelledby="sys-about">
                  <h2 id="sys-about" className="sys__h2">
                    {t('store.about')}
                  </h2>
                  <div className="prose sys__prose" dangerouslySetInnerHTML={{ __html: description }} />
                </section>
              )}
            </div>

            <aside className="sys__aside" aria-label={t('store.buyBox')}>
              <div className="buybox">
                <PriceTag price={s.price} />
                <button className="btn buybox__cta" onClick={() => setBooking(true)}>
                  {t('store.book')}
                </button>
                {site.whatsapp && (
                  <a className="btn btn--ghost buybox__wa" href={waLink(site.whatsapp)} target="_blank" rel="noopener noreferrer">
                    {t('store.askWhatsapp')}
                  </a>
                )}
                <p className="buybox__note">{t('store.bookNote')}</p>
                {s.requirements?.length > 0 && (
                  <div className="buybox__req">
                    <h2 className="buybox__h">
                      <Server size={17} aria-hidden="true" /> {t('store.requirements')}
                    </h2>
                    <ul>
                      {s.requirements.map((r, i) => (
                        <li key={i}>{pick(r)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppButton />
      <BookingDialog system={s} lang={lang} open={booking} onClose={() => setBooking(false)} />
    </>
  );
}

const EMPTY = { name: '', phone: '', email: '', company: '', preferredContact: 'whatsapp', message: '', website: '' };

function BookingDialog({ system, lang, open, onClose }) {
  const { t, pick } = useI18n();
  const uid = useId();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | done | error

  useEffect(() => {
    if (open) {
      setState('idle');
      setErrors({});
    }
  }, [open]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    // Clear the field's error as soon as it is edited (changing the contact method also clears the e-mail error).
    const clear = k === 'preferredContact' ? 'email' : k;
    if (errors[clear]) setErrors((er) => ({ ...er, [clear]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!form.name.trim()) er.name = t('store.form.required');
    if (form.phone.replace(/\D/g, '').length < 8) er.phone = t('store.form.phoneInvalid');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) er.email = t('store.form.emailInvalid');
    if (form.preferredContact === 'email' && !form.email.trim()) er.email = t('store.form.emailNeeded');
    setErrors(er);
    if (Object.keys(er).length) {
      document.getElementById(`${uid}-${Object.keys(er)[0]}`)?.focus();
      return;
    }
    setState('sending');
    try {
      await api.store.order(system.slug, { ...form, email: form.email.trim(), lang });
      setState('done');
      setForm(EMPTY);
    } catch (err) {
      setState(err.status === 429 ? 'limit' : 'error');
    }
  };

  const field = (k, label, props = {}, required = false) => (
    <div className={`field ${errors[k] ? 'has-error' : ''}`}>
      <label htmlFor={`${uid}-${k}`}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={`${uid}-${k}`}
        value={form[k]}
        onChange={set(k)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
        required={required}
        {...props}
      />
      {errors[k] && (
        <p className="field__error" id={`${uid}-${k}-err`}>
          {errors[k]}
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose} labelledBy={`${uid}-title`} className="bookdlg">
      <button className="bookdlg__close" onClick={onClose} aria-label={t('store.form.close')}>
        <X size={20} />
      </button>
      {state === 'done' ? (
        <div className="bookdlg__done" role="status">
          <CheckCircle2 size={44} aria-hidden="true" />
          <h2 id={`${uid}-title`}>{t('store.form.doneTitle')}</h2>
          <p>{t('store.form.doneText')}</p>
          <button className="btn" onClick={onClose} data-autofocus>
            {t('store.form.close')}
          </button>
        </div>
      ) : (
        <form className="bookdlg__form" onSubmit={submit} noValidate>
          <h2 id={`${uid}-title`}>{t('store.form.title')}</h2>
          <p className="bookdlg__sys">{pick(system.title)}</p>
          <div className="bookdlg__grid">
            {field('name', t('store.form.name'), { autoComplete: 'name', 'data-autofocus': true }, true)}
            {field('phone', t('store.form.phone'), { type: 'tel', dir: 'ltr', autoComplete: 'tel', inputMode: 'tel' }, true)}
            {field('email', t('store.form.email'), { type: 'email', dir: 'ltr', autoComplete: 'email' })}
            {field('company', t('store.form.company'), { autoComplete: 'organization' })}
          </div>
          <fieldset className="bookdlg__prefer">
            <legend>{t('store.form.prefer')}</legend>
            {['whatsapp', 'call', 'email'].map((p) => (
              <label key={p} className={`chip chip--light ${form.preferredContact === p ? 'is-on' : ''}`}>
                <input type="radio" name={`${uid}-prefer`} value={p} checked={form.preferredContact === p} onChange={set('preferredContact')} className="sr-only" />
                {t(`store.form.via.${p}`)}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor={`${uid}-message`}>{t('store.form.message')}</label>
            <textarea id={`${uid}-message`} rows={3} value={form.message} onChange={set('message')} placeholder={t('store.form.messageHint')} maxLength={3000} />
          </div>
          {/* Honeypot: hidden from people, filled by spam bots */}
          <div className="sr-only" aria-hidden="true">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
            </label>
          </div>
          {(state === 'error' || state === 'limit') && (
            <p className="bookdlg__err" role="alert">
              {t(state === 'limit' ? 'store.form.limit' : 'store.form.error')}
            </p>
          )}
          <button className="btn bookdlg__submit" type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? t('store.form.sending') : t('store.form.submit')}
          </button>
          <p className="bookdlg__privacy">{t('store.form.privacy')}</p>
        </form>
      )}
    </Dialog>
  );
}
