import { useEffect, useState } from 'react';
import { WifiOff, RotateCw } from 'lucide-react';
import { LogoMark } from './Logo.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from './Toast.jsx';
import '../site/notfound.css';
import './offline.css';

/** Real connectivity check: navigator.onLine can report "online" on a dead network. */
async function ping() {
  try {
    const res = await fetch(`/brand/favicon.png?ping=${Date.now()}`, { cache: 'no-store', method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export default function OfflineScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    const goOff = () => setOffline(true);
    const goOn = async () => {
      if (await ping()) {
        setOffline((was) => {
          if (was) toast(t('offline.back'));
          return false;
        });
      }
    };
    window.addEventListener('offline', goOff);
    window.addEventListener('online', goOn);
    return () => {
      window.removeEventListener('offline', goOff);
      window.removeEventListener('online', goOn);
    };
  }, [t, toast]);

  // While offline, quietly re-check every 8 seconds.
  useEffect(() => {
    if (!offline) return;
    const id = setInterval(async () => {
      if (await ping()) {
        setOffline(false);
        toast(t('offline.back'));
      }
    }, 8000);
    return () => clearInterval(id);
  }, [offline, t, toast]);

  if (!offline) return null;

  const retry = async () => {
    setChecking(true);
    setNote('');
    const ok = await ping();
    setChecking(false);
    if (ok) {
      setOffline(false);
      toast(t('offline.back'));
    } else setNote(t('offline.still'));
  };

  return (
    <div className="offline" role="alertdialog" aria-modal="true" aria-labelledby="offline-title" aria-describedby="offline-text">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="offline__card">
        <div className="offline__art" aria-hidden="true">
          <span className="offline__ring" />
          <span className="offline__ring" />
          <span className="offline__ring" />
          <span className="offline__tile">
            <LogoMark size={68} body="#fff" />
            <span className="offline__badge">
              <WifiOff size={24} strokeWidth={2.2} />
            </span>
          </span>
        </div>
        <span className="offline__status">Offline</span>
        <h2 id="offline-title">{t('offline.title')}</h2>
        <p id="offline-text">{t('offline.text')}</p>
        <button className="btn" onClick={retry} disabled={checking} autoFocus>
          <RotateCw size={18} className={checking ? 'spin' : ''} />
          {checking ? t('offline.checking') : t('offline.retry')}
        </button>
        <p className="offline__note" aria-live="polite">
          {note}
        </p>
      </div>
    </div>
  );
}
