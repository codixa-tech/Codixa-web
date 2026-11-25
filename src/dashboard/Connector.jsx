import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Info, ShieldOff } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../data/api.js';
import { useConfirm } from './ui.jsx';

const SOURCES = ['', 'connector', 'dashboard'];

export default function Connector() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [info, setInfo] = useState(null);
  const [log, setLog] = useState(null);
  const [source, setSource] = useState('');
  const [copied, setCopied] = useState(false);

  const when = (iso) =>
    iso ? new Date(iso).toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const loadInfo = useCallback(() => api.connector.info().then(setInfo).catch(() => setInfo({ url: '', grants: [] })), []);
  useEffect(() => {
    if (api.connector.available) loadInfo();
  }, [loadInfo]);
  useEffect(() => {
    if (!api.connector.available) return;
    setLog(null);
    api.activity.list({ source, limit: 150 }).then(setLog).catch(() => setLog([]));
  }, [source]);

  if (!api.connector.available) {
    return (
      <div className="stack">
        <div className="pagehead"><h1>{t('dash.connector.title')}</h1></div>
        <div className="notice notice--info"><Info size={18} /><div>{t('dash.connector.localOnly')}</div></div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast(t('dash.connector.copyFail'), 'err');
    }
  };

  const revoke = async (g) => {
    if (!(await confirm(t('dash.connector.revokeConfirm'), { okLabel: t('dash.connector.revoke') }))) return;
    await api.connector.revoke(g.id);
    toast(t('dash.connector.revoked'));
    loadInfo();
  };

  const actions = t('dash.connector.actions');
  const actionLabel = (a) => (actions && actions[a]) || a.replaceAll('_', ' ').replaceAll('.', ' · ');

  return (
    <div className="stack">
      <div className="pagehead"><h1>{t('dash.connector.title')}</h1></div>

      <section className="panel">
        <h2 className="panel__title">{t('dash.connector.claude')}</h2>
        <p className="muted">{t('dash.connector.intro')}</p>
        <div className="cxurl">
          <code dir="ltr">{info?.url || '…'}</code>
          <button className="btn btn--sm" onClick={copy} disabled={!info?.url}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t('dash.connector.copied') : t('dash.connector.copy')}
          </button>
        </div>
        <ol className="cxsteps">
          <li>{t('dash.connector.step1')}</li>
          <li>{t('dash.connector.step2')}</li>
          <li>{t('dash.connector.step3')}</li>
        </ol>
        <p className="muted small">{t('dash.connector.limits')}</p>

        <h3 className="cxsub">{t('dash.connector.access')}</h3>
        {!info ? (
          <p className="muted">{t('dash.common.loading')}</p>
        ) : info.grants.length === 0 ? (
          <p className="muted">{t('dash.connector.none')}</p>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('dash.connector.app')}</th>
                  <th>{t('dash.connector.user')}</th>
                  <th>{t('dash.connector.since')}</th>
                  <th>{t('dash.connector.lastUsed')}</th>
                  <th className="end" />
                </tr>
              </thead>
              <tbody>
                {info.grants.map((g) => (
                  <tr key={g.id} className={g.active ? '' : 'is-off'}>
                    <td>{g.client}</td>
                    <td dir="ltr">{g.user}</td>
                    <td className="num">{when(g.createdAt)}</td>
                    <td className="num">{when(g.lastUsedAt)}</td>
                    <td className="end">
                      {g.active ? (
                        <button className="btn btn--sm btn--danger-ghost" onClick={() => revoke(g)}>
                          <ShieldOff size={15} /> {t('dash.connector.revoke')}
                        </button>
                      ) : (
                        <span className="muted small">{t('dash.connector.revokedAt')} {when(g.revokedAt)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="cxhead">
          <h2 className="panel__title">{t('dash.connector.activity')}</h2>
          <div className="seg seg--sm" role="group" aria-label={t('dash.connector.activity')}>
            {SOURCES.map((s) => (
              <button key={s || 'all'} className={source === s ? 'is-on' : ''} aria-pressed={source === s} onClick={() => setSource(s)}>
                {t(`dash.connector.src.${s || 'all'}`)}
              </button>
            ))}
          </div>
        </div>
        {!log ? (
          <p className="muted">{t('dash.common.loading')}</p>
        ) : log.length === 0 ? (
          <p className="muted">{t('dash.connector.noActivity')}</p>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('dash.connector.time')}</th>
                  <th>{t('dash.connector.by')}</th>
                  <th>{t('dash.connector.action')}</th>
                  <th>{t('dash.connector.target')}</th>
                </tr>
              </thead>
              <tbody>
                {log.map((a) => (
                  <tr key={a.id}>
                    <td className="num">{when(a.createdAt)}</td>
                    <td>
                      <span className={`cxsrc cxsrc--${a.source}`}>{t(`dash.connector.src.${a.source}`)}</span>{' '}
                      <span dir="ltr" className="muted small">{a.user || ''}</span>
                    </td>
                    <td className="cxact">
                      {actionLabel(a.action)}
                      {!a.ok && <span className="cxfail"> · {t('dash.connector.failed')}</span>}
                      {!a.ok && a.detail?.error && <div className="muted small">{a.detail.error}</div>}
                    </td>
                    <td dir="ltr" className="muted small">{a.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
