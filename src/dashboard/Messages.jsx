import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ExternalLink, Mail, MessageCircle, Phone, ShoppingBag, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { date } from '../lib/format.js';
import { waLink } from '../lib/useSettings.js';
import { Empty, useConfirm } from './ui.jsx';

const KINDS = ['', 'order', 'contact'];
const ORDER_STATUSES = ['new', 'contacted', 'won', 'closed'];

/** Egyptian local mobiles (01xxxxxxxxx) become +20…; anything else is used as typed. */
const waNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('01') ? `2${d}` : d.replace(/^00/, '');
};

export default function Messages() {
  const { t, locale, pick } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const kind = KINDS.includes(params.get('kind') || '') ? params.get('kind') || '' : '';
  const openId = params.get('open');
  const { data: rows = [] } = useData(() => api.messages.list(kind ? { kind } : {}), [kind]);
  const services = Object.fromEntries(t('services.items').map((s) => [s.key, s.title]));
  const [flash, setFlash] = useState('');

  // Opened from a notification e-mail: scroll to the message and mark it read.
  useEffect(() => {
    if (!openId || !rows.length) return;
    const el = document.getElementById(`msg-${openId}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    setFlash(openId);
    const m = rows.find((x) => String(x.id) === openId);
    if (m && !m.read) api.messages.markRead(m.id);
  }, [openId, rows]);

  const setKind = (k) => {
    const next = new URLSearchParams(params);
    if (k) next.set('kind', k);
    else next.delete('kind');
    next.delete('open');
    setParams(next, { replace: true });
  };

  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.messages.title')}</h1>
        <div className="seg seg--sm" role="group" aria-label={t('dash.messages.filter')}>
          {KINDS.map((k) => (
            <button key={k || 'all'} className={kind === k ? 'is-on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {t(`dash.messages.kinds.${k || 'all'}`)}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <ul className="msgs">
          {rows.map((m) => {
            const isOrder = m.kind === 'order';
            return (
              <li key={m.id} id={`msg-${m.id}`} className={`msg panel ${m.read ? '' : 'is-new'} ${flash === String(m.id) ? 'is-flash' : ''}`}>
                <div className="msg__head">
                  <div>
                    <p className="msg__name">
                      {isOrder && (
                        <span className="pill pill--order">
                          <ShoppingBag size={13} /> {t('dash.messages.order')}
                        </span>
                      )}
                      {m.name} {m.company && <span className="muted">· {m.company}</span>}
                      {!m.read && <span className="pill pill--in_progress">{t('dash.messages.unread')}</span>}
                    </p>
                    <p className="muted small" dir="ltr">
                      {[m.email, m.phone].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <p className="muted small num">{date(m.createdAt, locale, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                {isOrder && m.system && (
                  <p className="msg__service">
                    {m.system.slug ? (
                      <a href={`/store/${m.system.slug}`} target="_blank" rel="noopener noreferrer">
                        {m.system.title} <ExternalLink size={13} />
                      </a>
                    ) : (
                      m.system.title
                    )}
                    {m.preferredContact && <span className="muted"> · {t(`dash.messages.prefer.${m.preferredContact}`)}</span>}
                  </p>
                )}
                {!isOrder && m.service && <p className="msg__service">{services[m.service] || m.service}</p>}
                {m.message && <p className="msg__body">{m.message}</p>}
                <div className="msg__tools">
                  {m.phone && (
                    <a className="btn btn--sm btn--wa" href={waLink(waNumber(m.phone))} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={16} /> {t('dash.messages.whatsapp')}
                    </a>
                  )}
                  {m.phone && (
                    <a className="btn btn--sm btn--ghost dark-ghost" href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}>
                      <Phone size={16} /> {t('dash.messages.call')}
                    </a>
                  )}
                  {m.email && (
                    <a className="btn btn--sm btn--ghost dark-ghost" href={`mailto:${m.email}?subject=${encodeURIComponent(isOrder ? `Codixa — ${m.system?.title || ''}` : 'Codixa')}`}>
                      <Mail size={16} /> {t('dash.messages.reply')}
                    </a>
                  )}
                  {isOrder && api.messages.setStatus && (
                    <label className="msg__status">
                      <span className="sr-only">{t('dash.messages.status')}</span>
                      <select
                        value={m.status || 'new'}
                        onChange={async (e) => {
                          await api.messages.setStatus(m.id, e.target.value);
                          toast(t('dash.messages.statusSaved'));
                        }}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {t(`dash.messages.statuses.${s}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {!m.read && (
                    <button className="btn btn--sm btn--ghost dark-ghost" onClick={() => api.messages.markRead(m.id)}>
                      <Check size={16} /> {t('dash.messages.markRead')}
                    </button>
                  )}
                  <button
                    className="iconbtn danger"
                    aria-label={t('dash.messages.remove')}
                    onClick={async () => {
                      if (await confirm(t('dash.messages.remove') + '?', { okLabel: t('dash.messages.remove') })) {
                        await api.messages.remove(m.id);
                        toast(t('dash.messages.remove'));
                      }
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>{t(kind === 'order' ? 'dash.messages.emptyOrders' : 'dash.messages.empty')}</Empty>
      )}
    </div>
  );
}
