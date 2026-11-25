import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../data/api.js';
import Loader from '../components/Loader.jsx';
import Nav from './Nav.jsx';
import Hero from './Hero.jsx';
import Services from './Services.jsx';
import Work from './Work.jsx';
import ProjectDialog from './ProjectDialog.jsx';
import Enterprise from './Enterprise.jsx';
import Training from './Training.jsx';
import Process from './Process.jsx';
import About from './About.jsx';
import Contact from './Contact.jsx';
import Footer from './Footer.jsx';
import WhatsAppButton from './WhatsAppButton.jsx';
import Faq from './Faq.jsx';
import Seo from '../seo/Seo.jsx';
import { HOME_FAQ, FAQ_TITLE } from '../seo/pages.js';
import { pathFor } from '../seo/config.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import './service.css';
import './site.css';

export default function SitePage({ lang = 'ar' }) {
  const { setLang } = useI18n();
  useEffect(() => setLang(lang), [lang, setLang]);
  const [fontsReady, setFontsReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [project, setProject] = useState(null);
  const [kind, setKind] = useState('project');
  const [preset, setPreset] = useState(null);

  useEffect(() => {
    let done = false;
    const finish = () => !done && ((done = true), setFontsReady(true));
    (document.fonts?.ready || Promise.resolve()).then(finish);
    const id = setTimeout(finish, 2500); // never block on a slow font
    return () => clearTimeout(id);
  }, []);

  const onLoaderDone = useCallback(() => setIntroDone(true), []);

  // Deep links (used by the 404 search and shareable URLs): /?project=<id> and /#section
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!introDone) return;
    const id = new URLSearchParams(location.search).get('project');
    if (id) {
      api.projects.list({ publishedOnly: true }).then((rows) => {
        const p = rows.find((x) => x.id === id);
        if (p) setProject(p);
        navigate({ pathname: pathFor(lang), hash: location.hash }, { replace: true });
      });
    } else if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introDone, location.search, location.hash]);

  const showTraining = () => {
    setKind('training');
    document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' });
  };
  const planTraining = () => {
    setPreset({ service: 'training', at: Date.now() });
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Seo lang={lang} />
      <Loader ready={fontsReady} onDone={onLoaderDone} />
      <Nav />
      <main id="main">
        <Hero introDone={introDone} onOpen={setProject} />
        <Services />
        <Work onOpen={setProject} kind={kind} setKind={setKind} />
        <Enterprise />
        <Training onShowWork={showTraining} onPlan={planTraining} onOpen={setProject} />
        <Process />
        <About />
        <Faq title={FAQ_TITLE[lang]} items={HOME_FAQ[lang]} />
        <Contact preset={preset} />
      </main>
      <Footer />
      <ProjectDialog project={project} onClose={() => setProject(null)} />
      <WhatsAppButton />
    </>
  );
}
