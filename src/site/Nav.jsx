import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { parseSitePath, pathFor } from '../seo/config.js';
import { Menu, X } from 'lucide-react';
import { Wordmark } from '../components/Logo.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

const LINKS = ['services', 'work', 'enterprise', 'training', 'about', 'contact'];

export default function Nav() {
  const { t, toggle, lang } = useI18n();
  const loc = useLocation();
  const navigate = useNavigate();
  const home = pathFor(lang);
  const onHome = loc.pathname.replace(/\/+$/, '') === home.replace(/\/+$/, '') || (home === '/' && loc.pathname === '/');
  const onStore = /^(\/en)?\/store(\/|$)/.test(loc.pathname);
  const SecLink = (props) => <SectionLink onHome={onHome} home={home} {...props} />;
  // Language switch moves between /page and /en/page so each language keeps its own URL.
  const switchLang = () => {
    const site = parseSitePath(loc.pathname);
    if (!site) return toggle();
    navigate(pathFor(lang === 'ar' ? 'en' : 'ar', site.slug) + loc.hash);
  };
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Highlight the section in view.
  useEffect(() => {
    const els = ['top', ...LINKS].map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCurrent(e.target.id === 'top' ? '' : e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('menu-open', open);
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <a className="skip" href="#main">
        {t('skip')}
      </a>
      <div className="container nav__bar">
        <Link to={home} className="nav__brand" aria-label="Codixa" onClick={() => setOpen(false)}>
          <Wordmark size={34} body="#fff" textColor="#fff" />
        </Link>
        <nav className="nav__links" aria-label="Main">
          {LINKS.slice(0, 5).map((id) => (
            <SecLink key={id} id={id} aria-current={onHome && current === id ? 'true' : undefined}>
              {t(`nav.${id}`)}
            </SecLink>
          ))}
          <Link to={pathFor(lang, 'store')} aria-current={onStore ? 'page' : undefined}>
            {t('nav.store')}
          </Link>
        </nav>
        <div className="nav__end">
          <button className="nav__lang" onClick={switchLang} aria-label={t('langSwitchLabel')} lang={lang === 'ar' ? 'en' : 'ar'}>
            {t('langSwitch')}
          </button>
          <SecLink id="contact" className="btn btn--sm nav__cta">
            {t('nav.cta')}
          </SecLink>
          <button className="nav__burger" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? t('nav.close') : t('nav.menu')} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      <div id="mobile-menu" className="nav__sheet" hidden={!open}>
        <nav aria-label="Mobile">
          {LINKS.map((id, i) => (
            <SecLink key={id} id={id} style={{ '--i': i }} onClick={() => setOpen(false)}>
              {t(`nav.${id}`)}
            </SecLink>
          ))}
          <Link to={pathFor(lang, 'store')} style={{ '--i': LINKS.length }} onClick={() => setOpen(false)}>
            {t('nav.store')}
          </Link>
        </nav>
        <SecLink id="contact" className="btn nav__sheet-cta" onClick={() => setOpen(false)}>
          {t('nav.cta')}
        </SecLink>
      </div>
    </header>
  );
}

// Section link: plain anchor on the home page, router link back to home elsewhere.
function SectionLink({ id, onHome, home, children, ...rest }) {
  return onHome ? (
    <a href={`#${id}`} {...rest}>
      {children}
    </a>
  ) : (
    <Link to={{ pathname: home, hash: `#${id}` }} {...rest}>
      {children}
    </Link>
  );
}
