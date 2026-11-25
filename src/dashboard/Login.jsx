import { useState } from 'react';
import { LogoMark } from '../components/Logo.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { Field } from './ui.jsx';

import { api } from '../data/api.js';

export default function Login({ onLogin }) {
  const { t, toggle } = useI18n();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.auth.login(user.trim(), pass);
      onLogin();
    } catch {
      setError(t('dash.login.wrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <button className="btn btn--sm btn--ghost login__lang" onClick={toggle}>
        {t('langSwitch')}
      </button>
      <form className="login__card" onSubmit={submit}>
        <LogoMark size={44} />
        <h1>{t('dash.login.title')}</h1>
        <Field label={t('dash.login.user')}>
          {(id) => <input id={id} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" dir="ltr" autoFocus />}
        </Field>
        <Field label={t('dash.login.password')} error={error}>
          {(id) => <input id={id} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" dir="ltr" />}
        </Field>
        <button className="btn" type="submit" disabled={busy}>
          {t('dash.login.submit')}
        </button>
        {api.auth.demo && <p className="login__demo">{t('dash.login.demo')}</p>}
      </form>
    </div>
  );
}
