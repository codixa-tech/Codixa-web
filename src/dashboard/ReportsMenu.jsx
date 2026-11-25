import { useEffect, useRef, useState } from 'react';
import { FileDown, ChevronDown, Lock } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../data/api.js';
import { useConfirm } from './ui.jsx';

/** Dropdown with the project's PDF reports (client / internal, Arabic / English). */
export default function ReportsMenu({ projectId, disabled }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const run = async (opts) => {
    setOpen(false);
    if (!api.reports.available) return toast(t('dash.reports.needsBackend'), 'err');
    if (opts.secrets && !(await confirm(t('dash.reports.secretsWarn'), { okLabel: t('dash.reports.internalSecrets'), danger: false }))) return;
    try {
      toast(t('dash.reports.opening'));
      await api.reports.open(projectId, opts);
    } catch {
      toast(t('dash.reports.failed'), 'err');
    }
  };

  const items = [
    { label: `${t('dash.reports.client')} — ${t('dash.reports.arabic')}`, opts: { type: 'client', lang: 'ar' } },
    { label: `${t('dash.reports.client')} — ${t('dash.reports.english')}`, opts: { type: 'client', lang: 'en' } },
    { label: `${t('dash.reports.internal')} — ${t('dash.reports.arabic')}`, opts: { type: 'internal', lang: 'ar' } },
    { label: `${t('dash.reports.internal')} — ${t('dash.reports.english')}`, opts: { type: 'internal', lang: 'en' } },
    { label: t('dash.reports.internalSecrets'), opts: { type: 'internal', lang: 'ar', secrets: true }, icon: Lock },
  ];

  return (
    <div className="menu" ref={ref}>
      <button
        className="btn btn--sm btn--ghost dark-ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? t('dash.reports.saveFirst') : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <FileDown size={16} /> {t('dash.reports.menu')} <ChevronDown size={15} />
      </button>
      {open && (
        <ul className="menu__list" role="menu">
          {items.map(({ label, opts, icon: Icon }) => (
            <li key={label} role="none">
              <button role="menuitem" onClick={() => run(opts)}>
                {Icon && <Icon size={14} />}
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
