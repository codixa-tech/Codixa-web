import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useData } from '../lib/useData.js';
import { api } from '../data/api.js';
import { CATEGORY_MAP } from '../config/categories.js';
import { Wordmark, C_PATH, DIAMOND_PATH, MARK_VIEWBOX } from '../components/Logo.jsx';
import { Img } from '../components/Media.jsx';
import CategoryIcon from '../components/CategoryIcon.jsx';
import { SERVICE_SLUGS, pathFor } from '../seo/config.js';
import { PAGES } from '../seo/pages.js';
import './notfound.css';

const norm = (s) => (s || '').toString().toLowerCase().normalize('NFKD').replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

export default function NotFound() {
  const { t, pick, toggle, lang } = useI18n();
  const home = pathFor(lang);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data: projects = [] } = useData(() => api.projects.list({ publishedOnly: true }), []);

  useEffect(() => {
    const prev = document.title;
    document.title = t('notFound.docTitle');
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.title = prev;
      meta.remove();
    };
  }, [t]);

  const results = useMemo(() => {
    const s = norm(q.trim());
    if (!s) return [];
    const words = s.split(/\s+/);
    const hit = (texts) => words.every((w) => texts.some((x) => norm(x).includes(w)));
    const prj = projects
      .filter((p) => hit([p.title?.ar, p.title?.en, p.summary?.ar, p.summary?.en, CATEGORY_MAP[p.category]?.label?.ar, CATEGORY_MAP[p.category]?.label?.en]))
      .map((p) => ({ type: 'project', id: p.id, title: pick(p.title), meta: pick(CATEGORY_MAP[p.category]?.single), icon: p.category, img: p.images?.[0] }));
    const svc = t('services.items')
      .filter((s2) => hit([s2.title, s2.text, ...s2.points]))
      .map((s2) => ({ type: 'service', id: s2.key, title: s2.title, meta: t('notFound.service'), icon: s2.key === 'ai' ? 'robotics' : s2.key }));
    return [...prj, ...svc].slice(0, 8);
  }, [q, projects, pick, t]);

  const open = (r) => (r.type === 'project' ? navigate(`${home}?project=${r.id}`) : navigate(`${home}#services`));
  const Arrow = document.documentElement.dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="nf">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <header className="nf__bar container">
        <Link to={home} aria-label="Codixa">
          <Wordmark size={32} body="#fff" textColor="#fff" />
        </Link>
        <button className="nav__lang" onClick={toggle}>
          {t('langSwitch')}
        </button>
      </header>

      <main className="nf__main container">
        <div className="nf__stage" aria-hidden="true" dir="ltr">
          <svg className="nf__orbit" viewBox="0 0 600 260" preserveAspectRatio="none">
            <ellipse cx="300" cy="130" rx="290" ry="120" />
          </svg>
          <span className="nf__digit nf__digit--a">4</span>
          <span className="nf__tile">
            <svg viewBox={MARK_VIEWBOX} overflow="visible">
              <path d={C_PATH} fill="#fff" />
              <path className="nf__slot" d={DIAMOND_PATH} />
            </svg>
          </span>
          <span className="nf__digit nf__digit--b">4</span>
          <span className="nf__lost" />
        </div>
        <h1 className="nf__title">{t('notFound.title')}</h1>
        <p className="nf__text">{t('notFound.text')}</p>

        <div className="nf__search" role="search">
          <Search size={20} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('notFound.search')} aria-label={t('notFound.search')} autoFocus />
        </div>

        {q.trim() && (
          <div className="nf__results" aria-live="polite">
            {results.length ? (
              <ul>
                {results.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    <button onClick={() => open(r)}>
                      <span className="nf__thumb">{r.img ? <Img src={r.img.thumb || r.img.src} w={96} h={60} alt="" /> : <CategoryIcon name={r.icon} />}</span>
                      <span className="nf__rtext">
                        <span className="nf__rtitle">{r.title}</span>
                        <span className="nf__rmeta">{r.meta}</span>
                      </span>
                      <Arrow size={18} className="nf__go" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nf__empty">{t('notFound.noResults', { q: q.trim() })}</p>
            )}
          </div>
        )}

        <div className="nf__actions">
          <Link className="btn" to={home}>
            {t('notFound.home')}
          </Link>
          <Link className="btn btn--ghost" to={{ pathname: home, hash: '#contact' }}>
            {t('notFound.contact')}
          </Link>
        </div>

        <nav className="nf__popular" aria-label={t('notFound.popular')}>
          <p>{t('notFound.popular')}</p>
          <ul>
            {SERVICE_SLUGS.map((s) => (
              <li key={s}>
                <Link to={pathFor(lang, s)}>{PAGES[s][lang].crumb}</Link>
              </li>
            ))}
            {['work', 'about'].map((id) => (
              <li key={id}>
                <Link to={{ pathname: home, hash: `#${id}` }}>{t(`nav.${id}`)}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
