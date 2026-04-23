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
  const [overviewMode, setOverviewMode] = useState<'ecommerce' | 'server-server' | 'client-server' | 'plugins' | 'client-server-order-request' | 'client-server-order-request-v06' | 'client-server-notification' | null>('ecommerce');

  const allEndpoints = useMemo(() => categories.flatMap(cat => cat.endpoints), [categories]);

  React.useEffect(() => {
    if (allEndpoints.length > 0 && !activeEndpoint && overviewMode === null) {
      setActiveEndpoint(allEndpoints[0].id);
    }
  }, [allEndpoints, activeEndpoint, overviewMode]);

  const handleViewChange = (view: 'endpoints' | 'project-info') => {
    setActiveView(view);
    if (view === 'endpoints') {
      setOverviewMode('ecommerce');
      setActiveEndpoint('');
    }
  };

  const handleEndpointSelect = (endpointId: string) => {
    setOverviewMode(null);
    setActiveEndpoint(endpointId);
  };

  const handleEcommerceOverviewSelect = () => {
    setOverviewMode('ecommerce');
    setActiveEndpoint('');
  };

  const handleServerServerOverviewSelect = () => {
    setOverviewMode('server-server');
    setActiveEndpoint('');
  };

  const handleClientServerOverviewSelect = () => {
    setOverviewMode('client-server');
    setActiveEndpoint('');
  };

  const handlePluginsOverviewSelect = () => {
    setOverviewMode('plugins');
    setActiveEndpoint('');
  };

  const handleClientServerOrderRequestSelect = () => {
    setOverviewMode('client-server-order-request');
    setActiveEndpoint('');
  };

  const handleClientServerOrderRequestV06Select = () => {
    setOverviewMode('client-server-order-request-v06');
    setActiveEndpoint('');
  };

  const handleClientServerNotificationSelect = () => {
    setOverviewMode('client-server-notification');
    setActiveEndpoint('');
  };

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
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          t={t}
        />

        <div className="flex-1 min-h-0 min-w-0 flex flex-col xl:flex-row">
          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto border-r border-paynet-gray-200">
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
                  <ClientServerOrderRequest />
                </div>
              ) : overviewMode === 'client-server-order-request-v06' ? (
                <div className="flex-1 w-full min-w-0">
                  <ClientServerOrderRequestV06 />
                </div>
              ) : overviewMode === 'client-server-notification' ? (
                <div className="flex-1 w-full min-w-0">
                  <ClientServerNotification />
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