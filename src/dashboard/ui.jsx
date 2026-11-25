import { createContext, useCallback, useContext, useId, useRef, useState } from 'react';
import { Copy, Check, Eye, EyeOff, X } from 'lucide-react';
import Dialog from '../components/Dialog.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { money } from '../lib/format.js';

/* ---------- Form primitives ---------- */
export function Field({ label, hint, error, tag, children, wide, id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <div className={`df ${wide ? 'df--wide' : ''} ${error ? 'has-error' : ''}`}>
      <label htmlFor={id} className="df__label">
        {label}
        {tag && <span className="df__tag">{tag}</span>}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {hint && !error && <p className="df__hint">{hint}</p>}
      {error && (
        <p className="df__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, id }) {
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden="true">
        <span />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

export function TagInput({ id, value = [], onChange, placeholder }) {
  const [text, setText] = useState('');
  const { t } = useI18n();
  const add = () => {
    const parts = text
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => !value.includes(x));
    if (parts.length) onChange([...value, ...parts]);
    setText('');
  };
  return (
    <div className="tags-in">
      {value.map((v) => (
        <span key={v} className="tags-in__tag">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`${t('dash.media.remove')} ${v}`}>
            <X size={13} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        placeholder={value.length ? t('dash.editor.addTag') : placeholder || t('dash.editor.addTag')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

export function SecretInput({ id, value = '', onChange, placeholder }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };
  return (
    <div className="secret">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" dir="ltr" spellCheck="false" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t('dash.editor.hide') : t('dash.editor.reveal')} title={show ? t('dash.editor.hide') : t('dash.editor.reveal')}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
      <button type="button" onClick={copy} disabled={!value} aria-label={t('dash.editor.copy')} title={copied ? t('dash.editor.copied') : t('dash.editor.copy')}>
        {copied ? <Check size={17} /> : <Copy size={17} />}
      </button>
    </div>
  );
}

export function CopyText({ value }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  if (!value) return <span className="muted">—</span>;
  return (
    <button
      type="button"
      className="copytext"
      dir="ltr"
      title={copied ? t('dash.editor.copied') : t('dash.editor.copy')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
    >
      <span>{value}</span>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

/* ---------- Display ---------- */
export function StatusPill({ status }) {
  const { t } = useI18n();
  return <span className={`pill pill--${status}`}>{t(`status.${status}`)}</span>;
}

export function Money({ value, currency, className = '' }) {
  const { locale } = useI18n();
  return <span className={`num ${className}`}>{money(value, currency, locale)}</span>;
}

/** Totals grouped by currency, e.g. { EGP: 45000, SAR: 12000 } -> "EGP 45,000 · SAR 12,000" */
export function MoneyList({ map }) {
  const { locale } = useI18n();
  const entries = Object.entries(map || {}).filter(([, v]) => v);
  if (!entries.length) return <span className="muted">—</span>;
  return (
    <span className="moneylist">
      {entries.map(([c, v]) => (
        <span key={c} className="num">
          {money(v, c, locale)}
        </span>
      ))}
    </span>
  );
}

export function PaidBar({ cost, paid }) {
  const pct = cost > 0 ? Math.min(100, Math.round((paid / cost) * 100)) : 0;
  return (
    <span className="paidbar" role="img" aria-label={`${pct}%`}>
      <span style={{ width: `${pct}%` }} className={pct >= 100 ? 'is-full' : ''} />
    </span>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="empty">
      <span className="empty__mark" aria-hidden="true" />
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ---------- Modal wrapper ---------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={id} className={`modal modal--${size}`}>
      <header className="modal__head">
        <h2 id={id}>{title}</h2>
        <button className="iconbtn" onClick={onClose} aria-label={t('dash.common.close')}>
          <X size={20} />
        </button>
      </header>
      <div className="modal__body">{children}</div>
      {footer && <footer className="modal__foot">{footer}</footer>}
    </Dialog>
  );
}

/* ---------- Confirm ---------- */
const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const { t } = useI18n();
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const confirm = useCallback((message, { danger = true, okLabel } = {}) => {
    setState({ message, danger, okLabel });
    return new Promise((resolve) => (resolver.current = resolve));
  }, []);
  const close = (v) => {
    resolver.current?.(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.okLabel || ''}
        size="sm"
        footer={
          <>
            <button className="btn btn--ghost btn--sm dark-ghost" onClick={() => close(false)}>
              {t('dash.common.cancel')}
            </button>
            <button className={`btn btn--sm ${state?.danger ? 'btn--danger' : ''}`} onClick={() => close(true)} data-autofocus>
              {state?.okLabel}
            </button>
          </>
        }
      >
        <p>{state?.message}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
