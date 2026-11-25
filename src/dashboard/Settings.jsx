import { useEffect, useRef, useState } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../data/api.js';
import { bytes } from '../lib/format.js';
import { useConfirm } from './ui.jsx';

export default function Settings() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(e)).catch(() => {});
  }, []);

  const download = async () => {
    const json = await api.backup.export();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `codixa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const restore = async (file) => {
    try {
      const json = JSON.parse(await file.text());
      await api.backup.import(json);
      toast(t('dash.settings.importDone'));
    } catch {
      toast(t('dash.settings.importFail'), 'err');
    }
  };

  const reset = async () => {
    if (!(await confirm(t('dash.settings.resetConfirm'), { okLabel: t('dash.settings.reset') }))) return;
    await api.backup.reset();
    toast(t('dash.settings.reset'));
  };

  return (
    <div className="stack">
      <div className="pagehead">
        <h1>{t('dash.settings.title')}</h1>
      </div>
      <section className="panel">
        <h2 className="panel__title">{t('dash.settings.backup')}</h2>
        <p className="muted">{t('dash.settings.backupText')}</p>
        <div className="btnrow">
          <button className="btn btn--sm" onClick={download}>
            <Download size={16} /> {t('dash.settings.export')}
          </button>
          {api.backup.canRestore && (
          <button className="btn btn--sm btn--ghost dark-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> {t('dash.settings.import')}
          </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              if (e.target.files[0]) restore(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </div>
        {usage && (
          <p className="muted small mt">
            {t('dash.settings.storage')}: <span className="num">{bytes(usage.usage)}</span>
          </p>
        )}
      </section>
      {api.backup.canRestore && (
      <section className="panel">
        <h2 className="panel__title">{t('dash.settings.reset')}</h2>
        <p className="muted">{t('dash.settings.resetText')}</p>
        <div className="btnrow">
          <button className="btn btn--sm btn--danger" onClick={reset}>
            <RotateCcw size={16} /> {t('dash.settings.reset')}
          </button>
        </div>
      </section>
      )}
    </div>
  );
}
