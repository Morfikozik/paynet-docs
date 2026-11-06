import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Sidebar } from './components/Sidebar';
import { SpecSelector } from './components/SpecSelector';
import { EndpointDetails } from './components/EndpointDetails';
import { ProjectInfo } from './components/ProjectInfo';
import { EcommerceOverview } from './components/EcommerceOverview';
import { ServerServerOverview } from './components/ServerServerOverview';
import { ClientServerOverview } from './components/ClientServerOverview';
import { PluginsOverview } from './components/PluginsOverview';
import { ClientServerOrderRequest } from './components/ClientServerOrderRequest';
import { ClientServerOrderRequestV06 } from './components/ClientServerOrderRequestV06';
import { ClientServerNotification } from './components/ClientServerNotification';
import { CodeExample } from './components/CodeExample';
import { GuidePage } from './components/GuidePage';
import { DEFAULT_GUIDE, getGuide, getGuides, guideUiText } from './content/guides';
import { useLanguage } from './hooks/useLanguage';
import { useOpenAPI } from './hooks/useOpenAPI';

function App() {
  const { language, changeLanguage, t, apiInfo } = useLanguage();
  const { 
    categories, 
    baseUrl, 
    currentSpec,
    selectedSpec, 
    setSelectedSpec, 
    availableSpecs, 
    specInfo 
  } = useOpenAPI(language);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEndpoint, setActiveEndpoint] = useState<string>('');
  // Temporarily keep Project Info hidden from UI by defaulting to endpoints.
  const [activeView, setActiveView] = useState<'endpoints' | 'project-info'>('endpoints');
  type OverviewMode = 'guide' | 'ecommerce' | 'server-server' | 'client-server' | 'plugins' | 'client-server-order-request' | 'client-server-order-request-v06' | 'client-server-notification';
  const [overviewMode, setOverviewMode] = useState<OverviewMode | null>('guide');
  const [activeGuide, setActiveGuide] = useState<string>(DEFAULT_GUIDE);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const guides = useMemo(() => getGuides(language), [language]);
  const currentGuide = getGuide(language, activeGuide);

  // Hash routing: #/guides/<slug>, #/page/<mode>, #/api/<endpointId>.
  // Makes every page linkable and lets guides link to each other.
  const pageModes: Record<string, OverviewMode> = {
    ecommerce: 'ecommerce',
    'server-server': 'server-server',
    'client-server': 'client-server',
    plugins: 'plugins',
    'order-request-v05': 'client-server-order-request',
    'order-request-v06': 'client-server-order-request-v06',
    notifications: 'client-server-notification',
  };

  const applyHash = React.useCallback((hash: string) => {
    const [, kind, value] = hash.match(/^#\/(guides|page|api)\/(.+)$/) || [];
    if (kind === 'guides' && value) {
      setActiveView('endpoints');
      setOverviewMode('guide');
      setActiveGuide(decodeURIComponent(value));
      setActiveEndpoint('');
    } else if (kind === 'page' && value && pageModes[value]) {
      setActiveView('endpoints');
      setOverviewMode(pageModes[value]);
      setActiveEndpoint('');
    } else if (kind === 'api' && value) {
      setActiveView('endpoints');
      setOverviewMode(null);
      setActiveEndpoint(decodeURIComponent(value));
    } else {
      setOverviewMode('guide');
      setActiveGuide(DEFAULT_GUIDE);
      setActiveEndpoint('');
    }
    if (contentRef.current) contentRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    applyHash(window.location.hash);
    const onHashChange = () => applyHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyHash]);

  const navigate = (hash: string) => {
    if (window.location.hash === hash) {
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

  const allEndpoints = useMemo(() => categories.flatMap(cat => cat.endpoints), [categories]);

  React.useEffect(() => {
    if (allEndpoints.length > 0 && !activeEndpoint && overviewMode === null) {
      setActiveEndpoint(allEndpoints[0].id);
    }
  }, [allEndpoints, activeEndpoint, overviewMode]);

  const handleViewChange = (view: 'endpoints' | 'project-info') => {
    setActiveView(view);
    if (view === 'endpoints') navigate(`#/guides/${DEFAULT_GUIDE}`);
  };

  const handleEndpointSelect = (endpointId: string) => navigate(`#/api/${endpointId}`);
  const handleGuideSelect = (slug: string) => navigate(`#/guides/${slug}`);
  const handleEcommerceOverviewSelect = () => navigate('#/page/ecommerce');
  const handleServerServerOverviewSelect = () => navigate('#/page/server-server');
  const handleClientServerOverviewSelect = () => navigate('#/page/client-server');
  const handlePluginsOverviewSelect = () => navigate('#/page/plugins');
  const handleClientServerOrderRequestSelect = () => navigate('#/page/order-request-v05');
  const handleClientServerOrderRequestV06Select = () => navigate('#/page/order-request-v06');
  const handleClientServerNotificationSelect = () => navigate('#/page/notifications');

  const currentEndpoint = allEndpoints.find(endpoint => endpoint.id === activeEndpoint);

  return (
    <div className="h-screen bg-gradient-to-br from-paynet-gray-50 to-paynet-light overflow-hidden flex flex-col">
      <Header
        language={language}
        onLanguageChange={changeLanguage}
        apiInfo={apiInfo}
      />
      
      <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row">
        <Sidebar
          categories={categories}
          currentSpec={currentSpec}
          activeEndpoint={activeEndpoint}
          activeView={activeView}
          onEndpointSelect={handleEndpointSelect}
          onViewChange={handleViewChange}
          onEcommerceOverviewSelect={handleEcommerceOverviewSelect}
          onServerServerOverviewSelect={handleServerServerOverviewSelect}
          onClientServerOverviewSelect={handleClientServerOverviewSelect}
          onPluginsOverviewSelect={handlePluginsOverviewSelect}
          onClientServerOrderRequestSelect={handleClientServerOrderRequestSelect}
          onClientServerOrderRequestV06Select={handleClientServerOrderRequestV06Select}
          onClientServerNotificationSelect={handleClientServerNotificationSelect}
          ecommerceOverviewActive={overviewMode === 'ecommerce'}
          serverServerOverviewActive={overviewMode === 'server-server'}
          clientServerOverviewActive={overviewMode === 'client-server'}
          pluginsOverviewActive={overviewMode === 'plugins'}
          clientServerOrderRequestActive={overviewMode === 'client-server-order-request'}
          clientServerOrderRequestV06Active={overviewMode === 'client-server-order-request-v06'}
          clientServerNotificationActive={overviewMode === 'client-server-notification'}
          guides={guides}
          activeGuide={overviewMode === 'guide' ? activeGuide : null}
          onGuideSelect={handleGuideSelect}
          guidesTitle={guideUiText[language].section}
          notificationsLabel={guideUiText[language].notifications}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          t={t}
        />

        <div className="flex-1 min-h-0 min-w-0 flex flex-col xl:flex-row">
          <div ref={contentRef} className="flex-1 min-h-0 min-w-0 overflow-y-auto border-r border-paynet-gray-200">
            <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col bg-white">
              <SpecSelector
                availableSpecs={availableSpecs}
                selectedSpec={selectedSpec}
                onSpecChange={setSelectedSpec}
                specInfo={specInfo}
              />
              
              {activeView === 'project-info' ? (
                <div className="flex-1 w-full min-w-0">
                  <ProjectInfo t={t} language={language} />
                </div>
              ) : overviewMode === 'guide' && currentGuide ? (
                <div className="flex-1 w-full min-w-0">
                  <GuidePage guide={currentGuide} language={language} onNavigate={handleMarkdownNavigate} />
                </div>
              ) : overviewMode === 'ecommerce' ? (
                <div className="flex-1 w-full min-w-0">
                  <EcommerceOverview t={t} />
                </div>
              ) : overviewMode === 'server-server' ? (
                <div className="flex-1 w-full min-w-0">
                  <ServerServerOverview t={t} />
                </div>
              ) : overviewMode === 'client-server' ? (
                <div className="flex-1 w-full min-w-0">
                  <ClientServerOverview t={t} />
                </div>
              ) : overviewMode === 'plugins' ? (
                <div className="flex-1 w-full min-w-0">
                  <PluginsOverview />
                </div>
              ) : overviewMode === 'client-server-order-request' ? (
                <div className="flex-1 w-full min-w-0">
                  <ClientServerOrderRequest language={language} />
                </div>
              ) : overviewMode === 'client-server-order-request-v06' ? (
                <div className="flex-1 w-full min-w-0">
                  <ClientServerOrderRequestV06 language={language} />
                </div>
              ) : overviewMode === 'client-server-notification' ? (
                <div className="flex-1 w-full min-w-0">
                  <ClientServerNotification language={language} />
                </div>
              ) : currentEndpoint ? (
                <div className="flex-1 w-full min-w-0">
                  <EndpointDetails 
                    endpoint={currentEndpoint} 
                    baseUrl={baseUrl} 
                    servers={currentSpec?.servers}
                    t={t}
                    language={language}
                    spec={currentSpec}
                  />
                </div>
              ) : (
                <div className="w-full flex-1 min-w-0">
                  <div className="text-center py-16">
                    <h1 className="text-4xl font-bold text-paynet-gray-900 mb-4">
                    </h1>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-paynet-primary mb-4">
                      {t.welcome.title}
                    </h1>
                    <p className="text-base sm:text-lg lg:text-xl text-paynet-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
                      {t.welcome.subtitle}
                    </p>
                    <div className="bg-white p-6 lg:p-8 rounded-lg shadow-paynet-xl text-left w-full border border-paynet-gray-200 mx-auto">
                      <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-paynet-primary mb-3 sm:mb-4">{t.welcome.authTitle}</h2>
                      <p className="text-sm sm:text-base text-paynet-gray-600 mb-3 sm:mb-4">
                        {t.welcome.authDescription}
                      </p>
                      <pre className="bg-paynet-gray-50 p-4 rounded-lg text-sm overflow-x-auto mb-4 border border-paynet-gray-200 w-full font-mono">
                        <code>TPS_API_KEY: your_api_key_here{'\n'}X-API-KEY: your_password_here</code>
                      </pre>
                      <p className="text-paynet-gray-600 mt-3 sm:mt-4 text-xs sm:text-sm">
                        {t.welcome.authNote}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {activeView === 'endpoints' && currentEndpoint && overviewMode === null && (
            <div className="w-full xl:w-144 bg-white overflow-y-auto flex-shrink-0 border-t xl:border-t-0 xl:border-l border-paynet-gray-200 max-h-96 xl:max-h-none">
              <div className="p-4 sm:p-6">
                <CodeExample endpoint={currentEndpoint} baseUrl={baseUrl} spec={currentSpec} t={t} />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <Footer 
        author={apiInfo.author} 
        version={apiInfo.version} 
      />
    </div>
  );
}

export default App;