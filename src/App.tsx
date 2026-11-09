import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Sidebar, Route } from './components/Sidebar';
import { EndpointDetails } from './components/EndpointDetails';
import { PluginsOverview } from './components/PluginsOverview';
import { ClientServerOrderRequestV06 } from './components/ClientServerOrderRequestV06';
import { ClientServerNotification } from './components/ClientServerNotification';
import { CodeExample } from './components/CodeExample';
import { GuidePage } from './components/GuidePage';
import { HomePage } from './components/HomePage';
import { getGuide } from './content/guides';
import { useLanguage } from './hooks/useLanguage';
import { useOpenAPI } from './hooks/useOpenAPI';

/**
 * Hash routes (every page is linkable):
 *   #/                       home (product catalogue)
 *   #/guides/<slug>          guide from content/<lang>/<section>/NN-<slug>.md
 *   #/page/<tool>            interactive tools: checkout-form, notification-simulator, plugins
 *   #/api/<endpointId>       API method with the online tester
 * Old links from the previous portal structure are redirected (see LEGACY_PAGES).
 */
const LEGACY_PAGES: Record<string, string> = {
  ecommerce: '#/guides/integration-options',
  'server-server': '#/guides/server-to-server',
  'client-server': '#/guides/hosted-checkout',
  'order-request-v05': '#/guides/hosted-checkout',
  'order-request-v06': '#/page/checkout-form',
  notifications: '#/page/notification-simulator',
};

const TOOL_PAGES = ['plugins', 'checkout-form', 'notification-simulator'] as const;
type ToolPage = (typeof TOOL_PAGES)[number];

const parseHash = (hash: string): Route | { redirect: string } => {
  const [, kind, value] = hash.match(/^#\/(guides|page|api)\/(.+)$/) || [];
  if (kind === 'guides' && value) return { kind: 'guide', slug: decodeURIComponent(value) };
  if (kind === 'page' && value) {
    if ((TOOL_PAGES as readonly string[]).includes(value)) return { kind: 'page', page: value as ToolPage };
    if (LEGACY_PAGES[value]) return { redirect: LEGACY_PAGES[value] };
  }
  if (kind === 'api' && value) return { kind: 'api', endpointId: decodeURIComponent(value) };
  return { kind: 'home' };
};

function App() {
  const { language, changeLanguage, t, apiInfo } = useLanguage();
  const { categories, baseUrl, currentSpec } = useOpenAPI(language);

  const [searchQuery, setSearchQuery] = useState('');
  const [route, setRoute] = useState<Route>({ kind: 'home' });
  const contentRef = React.useRef<HTMLDivElement>(null);

  const applyHash = React.useCallback((hash: string) => {
    const parsed = parseHash(hash);
    if ('redirect' in parsed) {
      window.location.replace(parsed.redirect);
      return;
    }
    setRoute(parsed);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);

  React.useEffect(() => {
    applyHash(window.location.hash);
    const onHashChange = () => applyHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyHash]);

  const navigate = (hash: string) => {
    if (window.location.hash === hash || (hash === '#/' && !window.location.hash)) {
      applyHash(hash);
    } else {
      window.location.hash = hash;
    }
  };

  const handleMarkdownNavigate = (href: string) => {
    if (href.startsWith('#/')) {
      navigate(href);
      return;
    }
    const target = document.getElementById(href.replace(/^#/, ''));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const allEndpoints = useMemo(() => categories.flatMap((category) => category.endpoints), [categories]);
  const currentEndpoint = route.kind === 'api' ? allEndpoints.find((endpoint) => endpoint.id === route.endpointId) : undefined;
  const currentGuide = route.kind === 'guide' ? getGuide(language, route.slug) : undefined;

  const renderContent = () => {
    if (route.kind === 'guide') {
      return currentGuide ? (
        <GuidePage guide={currentGuide} language={language} onNavigate={handleMarkdownNavigate} />
      ) : (
        <HomePage language={language} onNavigate={navigate} />
      );
    }
    if (route.kind === 'page') {
      if (route.page === 'plugins') return <PluginsOverview />;
      if (route.page === 'checkout-form') return <ClientServerOrderRequestV06 language={language} />;
      return <ClientServerNotification language={language} />;
    }
    if (route.kind === 'api') {
      return currentEndpoint ? (
        <EndpointDetails
          endpoint={currentEndpoint}
          baseUrl={baseUrl}
          servers={currentSpec?.servers}
          t={t}
          language={language}
          spec={currentSpec}
          onNavigate={navigate}
        />
      ) : null;
    }
    return <HomePage language={language} onNavigate={navigate} />;
  };

  return (
    <div className="h-screen bg-gradient-to-br from-paynet-gray-50 to-paynet-light overflow-hidden flex flex-col">
      <Header language={language} onLanguageChange={changeLanguage} apiInfo={apiInfo} onHome={() => navigate('#/')} />

      <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row">
        <Sidebar
          language={language}
          categories={categories}
          currentSpec={currentSpec}
          route={route}
          navigate={navigate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="flex-1 min-h-0 min-w-0 flex flex-col xl:flex-row">
          <div ref={contentRef} className="flex-1 min-h-0 min-w-0 overflow-y-auto border-r border-paynet-gray-200">
            <div className="p-4 sm:p-6 lg:p-8 min-h-full flex flex-col bg-white">
              <div className="flex-1 w-full min-w-0">{renderContent()}</div>
            </div>
          </div>

          {currentEndpoint && (
            <div className="w-full xl:w-144 bg-white overflow-y-auto flex-shrink-0 border-t xl:border-t-0 xl:border-l border-paynet-gray-200 max-h-96 xl:max-h-none">
              <div className="p-4 sm:p-6">
                <CodeExample endpoint={currentEndpoint} baseUrl={baseUrl} spec={currentSpec} t={t} />
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer author={apiInfo.author} version={apiInfo.version} />
    </div>
  );
}

export default App;
