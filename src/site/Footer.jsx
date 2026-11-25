import { Link } from 'react-router-dom';
import { PAGES } from '../seo/pages.js';
import { SERVICE_SLUGS, pathFor } from '../seo/config.js';
import SocialIcon from '../components/SocialIcons.jsx';
import { Wordmark } from '../components/Logo.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useSettings } from '../lib/useSettings.js';

export default function Footer() {
  const { t, lang } = useI18n();
  const home = pathFor(lang);
  const site = useSettings();
  const year = new Date().getFullYear();
  const social = ['linkedin', 'facebook', 'instagram', 'x', 'youtube', 'tiktok', 'github'].filter((k) => site.social?.[k]);
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <Wordmark size={34} body="#fff" textColor="#fff" />
          <p className="footer__tag">{t('footer.tagline')}</p>
        </div>
        <nav className="footer__links" aria-label={t('nav.servicesNav')}>
          {SERVICE_SLUGS.map((s) => (
            <Link key={s} to={pathFor(lang, s)}>
              {PAGES[s][lang].crumb}
            </Link>
          ))}
          {['work', 'about', 'contact'].map((id) => (
            <Link key={id} to={{ pathname: home, hash: `#${id}` }}>
              {t(`nav.${id}`)}
            </Link>
          ))}
        </nav>
        <div className="footer__end">
          <p className="footer__partner">
            {t('footer.partner')}: <strong dir="ltr">{site.partnerName}</strong>
          </p>
          {social.length > 0 && (
          <ul className="footer__social">
            {social.map((k) => (
              <li key={k}>
                <a href={site.social[k]} target="_blank" rel="noopener noreferrer" aria-label={k}>
                  <SocialIcon name={k} />
                </a>
              </li>
            ))}
          </ul>
          )}
        </div>
      </div>
      <div className="container footer__bottom">
        <p>
          © <span className="num">{year}</span> Codixa. {t('footer.rights')}
        </p>
        <Link to="/dashboard" className="footer__login">
          {t('footer.dashboard')}
        </Link>
      </div>
    </footer>
  );
}
