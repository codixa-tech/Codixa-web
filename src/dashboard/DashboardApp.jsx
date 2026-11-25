import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Link, useNavigate, Navigate } from 'react-router-dom';
import { LayoutGrid, FolderKanban, Wallet, Users, Inbox, ExternalLink, LogOut, Menu, X, Plus, Globe2, DatabaseBackup, Plug, ShoppingBag, BarChart3 } from 'lucide-react';
import { Wordmark } from '../components/Logo.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { ConfirmProvider } from './ui.jsx';
import Login from './Login.jsx';
import Overview from './Overview.jsx';
import Projects from './Projects.jsx';
import ProjectEditor from './ProjectEditor.jsx';
import Payments from './Payments.jsx';
import Clients from './Clients.jsx';
import Messages from './Messages.jsx';
import Settings from './Settings.jsx';
import Connector from './Connector.jsx';
import SiteSettings from './SiteSettings.jsx';
import Analytics from './Analytics.jsx';
import { StoreList, SystemEditor } from './Store.jsx';
import './dashboard.css';

export default function DashboardApp() {
  const [authed, setAuthed] = useState(() => api.auth.isAuthed());

  // An expired session (refresh token rejected by the server) returns to the login screen.
  useEffect(() => {
    const out = () => setAuthed(false);
    window.addEventListener('codixa:logout', out);
    return () => window.removeEventListener('codixa:logout', out);
  }, []);

  // The owner's own browsing of the public site is not counted in the visitor statistics.
  useEffect(() => {
    if (!authed) return;
    try {
      localStorage.setItem('codixa.notrack', '1');
    } catch {
      /* storage unavailable */
    }
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <ConfirmProvider>
      <Shell
        onLogout={() => {
          api.auth.logout();
          setAuthed(false);
        }}
      />
    </ConfirmProvider>
  );
}

function Shell({ onLogout }) {
  const { t, toggle } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: stats } = useData(() => api.stats.overview(), []);

  const items = [
    { to: '', end: true, icon: LayoutGrid, label: t('dash.nav.overview') },
    { to: 'analytics', icon: BarChart3, label: t('dash.nav.analytics') },
    { to: 'projects', icon: FolderKanban, label: t('dash.nav.projects') },
    { to: 'store', icon: ShoppingBag, label: t('dash.nav.store') },
    { to: 'payments', icon: Wallet, label: t('dash.nav.payments') },
    { to: 'clients', icon: Users, label: t('dash.nav.clients') },
    { to: 'messages', icon: Inbox, label: t('dash.nav.messages'), badge: stats?.unread },
    { to: 'site', icon: Globe2, label: t('dash.nav.siteSettings') },
    { to: 'connector', icon: Plug, label: t('dash.nav.connector') },
    { to: 'settings', icon: DatabaseBackup, label: t('dash.nav.settings') },
  ];

  return (
    <div className={`dash ${open ? 'is-menu' : ''}`}>
      <aside className="side" aria-label={t('dash.brand')}>
        <div className="side__brand">
          <Link to="/dashboard" onClick={() => setOpen(false)}>
            <Wordmark size={26} body="#fff" textColor="#fff" />
          </Link>
          <button className="iconbtn side__close" onClick={() => setOpen(false)} aria-label={t('nav.close')}>
            <X size={20} />
          </button>
        </div>
        <p className="side__label">{t('dash.brand')}</p>
        <nav className="side__nav">
          {items.map(({ to, end, icon: Icon, label, badge }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {!!badge && <span className="side__badge num">{badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="side__foot">
          <Link to="/" className="side__link">
            <ExternalLink size={17} /> {t('dash.nav.site')}
          </Link>
          <button className="side__link" onClick={onLogout}>
            <LogOut size={17} /> {t('dash.nav.logout')}
          </button>
        </div>
      </aside>
      <div className="side__scrim" onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button className="iconbtn topbar__menu" onClick={() => setOpen(true)} aria-label={t('nav.menu')}>
            <Menu size={22} />
          </button>
          <div className="topbar__end">
            <button className="btn btn--sm btn--ghost dark-ghost" onClick={toggle}>
              {t('langSwitch')}
            </button>
            <button className="btn btn--sm" onClick={() => navigate('/dashboard/projects/new')}>
              <Plus size={17} /> {t('dash.projects.new')}
            </button>
          </div>
        </header>
        <main className="page" id="dash-main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/new" element={<ProjectEditor />} />
            <Route path="projects/:id" element={<ProjectEditor />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="store" element={<StoreList />} />
            <Route path="store/new" element={<SystemEditor />} />
            <Route path="store/:id" element={<SystemEditor />} />
            <Route path="payments" element={<Payments />} />
            <Route path="clients" element={<Clients />} />
            <Route path="messages" element={<Messages />} />
            <Route path="site" element={<SiteSettings />} />
            <Route path="connector" element={<Connector />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
