import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, useParams } from 'react-router-dom';
import { trackPage } from './lib/track.js';
import { SERVICE_SLUGS } from './seo/config.js';
import ServicePage from './site/ServicePage.jsx';
import SitePage from './site/SitePage.jsx';
import NotFound from './site/NotFound.jsx';
import OfflineScreen from './components/OfflineScreen.jsx';

// The dashboard is a separate chunk: visitors of the public site never download it.
const DashboardApp = lazy(() => import('./dashboard/DashboardApp.jsx'));
const StorePage = lazy(() => import('./site/StorePage.jsx'));
const SystemPage = lazy(() => import('./site/SystemPage.jsx'));

export default function App() {
  const loc = useLocation();
  useEffect(() => {
    trackPage(loc.pathname, loc.search);
  }, [loc.pathname, loc.search]);

  const lazyPage = (el) => <Suspense fallback={<div className="page-boot" />}>{el}</Suspense>;

  return (
    <>
    <Routes>
      <Route path="/store" element={lazyPage(<StorePage lang="ar" />)} />
      <Route path="/en/store" element={lazyPage(<StorePage lang="en" />)} />
      <Route path="/store/:slug" element={lazyPage(<SystemRoute lang="ar" />)} />
      <Route path="/en/store/:slug" element={lazyPage(<SystemRoute lang="en" />)} />
      <Route path="/" element={<SitePage lang="ar" />} />
      <Route path="/en" element={<SitePage lang="en" />} />
      <Route path="/:slug" element={<ServiceRoute lang="ar" />} />
      <Route path="/en/:slug" element={<ServiceRoute lang="en" />} />
      <Route
        path="/dashboard/*"
        element={
          <Suspense fallback={<div className="dash-boot" />}>
            <DashboardApp />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <OfflineScreen />
    </>
  );
}

function ServiceRoute({ lang }) {
  const { slug } = useParams();
  return SERVICE_SLUGS.includes(slug) ? <ServicePage key={`${lang}-${slug}`} lang={lang} slug={slug} /> : <NotFound />;
}

function SystemRoute({ lang }) {
  const { slug } = useParams();
  return <SystemPage key={`${lang}-${slug}`} lang={lang} slug={slug} />;
}
