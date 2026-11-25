import { useEffect, useState } from 'react';
import { C_PATH, DIAMOND_PATH, MARK_VIEWBOX } from './Logo.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import './loader.css';

const SESSION_KEY = 'codixa.loaderSeen';

/**
 * Brand loader: the C is traced as an outline, fills in, the cyan diamond drops into its notch,
 * then the wordmark types in and the whole panel lifts away. Full sequence on the first visit of a
 * session, a short version afterwards, and an instant fade for reduced-motion users.
 */
export default function Loader({ ready = true, onDone }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState('run'); // run -> leave -> gone
  const [mode] = useState(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
    try {
      return sessionStorage.getItem(SESSION_KEY) ? 'short' : 'full';
    } catch {
      return 'full';
    }
  });
  const minTime = mode === 'full' ? 2400 : mode === 'short' ? 1000 : 200;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMinElapsed(true), minTime);
    document.documentElement.style.overflow = 'hidden';
    return () => clearTimeout(id);
  }, [minTime]);

  useEffect(() => {
    if (ready && minElapsed && phase === 'run') {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {}
      setPhase('leave');
    }
  }, [ready, minElapsed, phase]);

  // Separate effect so the exit timer is not cancelled by the phase change that starts it.
  useEffect(() => {
    if (phase !== 'leave') return;
    onDone?.(); // let the hero start its entrance while the panels part
    const id = setTimeout(() => {
      setPhase('gone');
      document.documentElement.style.overflow = '';
    }, mode === 'reduced' ? 200 : 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div className={`loader loader--${mode} ${phase === 'leave' ? 'is-leaving' : ''}`} role="status" aria-live="polite" aria-label="Codixa">
      <div className="loader__panel loader__panel--a" />
      <div className="loader__panel loader__panel--b" />
      <div className="loader__stage">
        <svg className="loader__mark" viewBox={MARK_VIEWBOX} aria-hidden="true">
          <defs>
            <clipPath id="ldr-clip">
              <path d={C_PATH} />
            </clipPath>
          </defs>
          <path className="loader__trace" d={C_PATH} pathLength="1" />
          <g clipPath="url(#ldr-clip)">
            <rect className="loader__fill" x="262" y="237" width="481" height="549" />
          </g>
          <g className="loader__diamond-wrap">
            <path className="loader__diamond" d={DIAMOND_PATH} />
          </g>
          <circle className="loader__ping" cx="677" cy="512" r="58" />
        </svg>
        <div className="loader__word" dir="ltr">
          {'Codixa'.split('').map((ch, i) => (
            <span key={i} style={{ '--i': i }}>
              {ch}
            </span>
          ))}
        </div>
        <p className="loader__tagline">{t('loader.tagline')}</p>
        <div className="loader__bar">
          <span />
        </div>
      </div>
    </div>
  );
}
