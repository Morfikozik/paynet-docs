import React from 'react';
import { Search, ChevronRight, Book, Download } from 'lucide-react';
import { ServiceCategory } from '../types/api';
import { TranslationResources } from '../types/language';

interface SidebarProps {
  categories: ServiceCategory[];
  activeEndpoint: string;
  activeView: 'endpoints' | 'project-info';
  onEndpointSelect: (endpointId: string) => void;
  onViewChange: (view: 'endpoints' | 'project-info') => void;
  onEcommerceOverviewSelect: () => void;
  onServerServerOverviewSelect: () => void;
  onClientServerOverviewSelect: () => void;
  onClientServerOrderRequestSelect: () => void;
  onClientServerNotificationSelect: () => void;
  ecommerceOverviewActive: boolean;
  serverServerOverviewActive: boolean;
  clientServerOverviewActive: boolean;
  clientServerOrderRequestActive: boolean;
  clientServerNotificationActive: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  t: TranslationResources;
}

export const Sidebar: React.FC<SidebarProps> = ({
  categories,
  activeEndpoint,
  activeView,
  onEndpointSelect,
  onViewChange,
  onEcommerceOverviewSelect,
  onServerServerOverviewSelect,
  onClientServerOverviewSelect,
  onClientServerOrderRequestSelect,
  onClientServerNotificationSelect,
  ecommerceOverviewActive,
  serverServerOverviewActive,
  clientServerOverviewActive,
  clientServerOrderRequestActive,
  clientServerNotificationActive,
  searchQuery,
  onSearchChange,
  t,
}) => {
  const [isEcommerceOpen, setIsEcommerceOpen] = React.useState(true);
  const [isClientModelOpen, setIsClientModelOpen] = React.useState(false);
  const [isServerModelOpen, setIsServerModelOpen] = React.useState(false);

  const filteredEndpoints = categories
    .flatMap((category) => category.endpoints)
    .filter((endpoint) =>
      endpoint.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(searchQuery.toLowerCase())
    );

  React.useEffect(() => {
    if (searchQuery.trim()) {
      setIsEcommerceOpen(true);
      setIsServerModelOpen(true);
    }
  }, [searchQuery]);

  return (
    <div className="w-full md:w-72 lg:w-80 bg-paynet-gray-50 border-r border-paynet-gray-200 flex flex-col md:flex-shrink-0 max-h-[45vh] md:max-h-none">
      <div className="p-6 border-b border-paynet-gray-200 flex-shrink-0 bg-white">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-paynet-gray-900">API Documentation</h2>
        </div>
        
        {/* View Toggle */}
        <div className="flex mb-4 bg-paynet-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewChange('project-info')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeView === 'project-info'
                ? 'bg-white text-paynet-primary shadow-paynet font-semibold'
                : 'text-paynet-gray-600 hover:text-paynet-gray-900'
            } flex items-center justify-center gap-1`}
          >
            <Book className="w-4 h-4" />
            {t.common.projectInfo}
          </button>
          <button
            onClick={() => onViewChange('endpoints')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-1 ${
              activeView === 'endpoints'
                ? 'bg-white text-paynet-primary shadow-paynet font-semibold'
                : 'text-paynet-gray-600 hover:text-paynet-gray-900'
            }`}
          >
            {t.common.endpoints}
          </button>
        </div>
        
        {activeView === 'endpoints' && (
        <>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-paynet-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder={t.placeholders.searchEndpoints}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-paynet-gray-300 rounded-lg focus:ring-2 focus:ring-paynet-primary focus:border-transparent transition-all duration-200 bg-white"
          />
        </div>
        
        {/* Download Postman Collection Link */}
        <div className="mt-4">
          <a
            href="openapi.json"
            download="postman-collection.json"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-paynet-primary hover:text-paynet-secondary hover:bg-paynet-light rounded-lg transition-all duration-200 border border-paynet-gray-200 hover:border-paynet-primary bg-white"
          >
            <Download className="w-4 h-4" />
            {t.placeholders.downloadPostmanCollection}
          </a>
        </div>
        </>
        )}
      </div>

      {activeView === 'endpoints' && (
      <nav className="p-4 flex-1 overflow-y-auto min-h-0 bg-paynet-gray-50">
        <div className="mb-3">
          <button
            type="button"
            onClick={() => {
              setIsEcommerceOpen((prev) => {
                const next = !prev;
                if (next) {
                  setIsServerModelOpen(true);
                  setIsClientModelOpen(true);
                  onEcommerceOverviewSelect();
                }
                return next;
              });
            }}
            className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
              ecommerceOverviewActive
                ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-paynet-gray-900">Ecommerce</span>
              <ChevronRight className={`w-4 h-4 text-paynet-gray-500 transition-transform ${isEcommerceOpen ? 'rotate-90' : ''}`} />
            </div>
          </button>
        </div>

        {isEcommerceOpen && (
          <div className="pl-3">
            <div className="mb-3">
              <button
                type="button"
                onClick={() => {
                  setIsServerModelOpen((prev) => !prev);
                  onServerServerOverviewSelect();
                }}
                className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                  serverServerOverviewActive
                    ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                    : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-paynet-gray-900">Server-Server model</span>
                  <ChevronRight className={`w-4 h-4 text-paynet-gray-500 transition-transform ${isServerModelOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>
            </div>

            {isServerModelOpen && (
              <div className="space-y-1 pl-3">
                {filteredEndpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    onClick={() => onEndpointSelect(endpoint.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                      activeEndpoint === endpoint.id && !ecommerceOverviewActive && !serverServerOverviewActive
                        ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                        : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-mono px-2 py-1 rounded-md font-semibold ${
                            endpoint.method === 'GET' ? 'bg-green-100 text-green-700' :
                            endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                            endpoint.method === 'PUT' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {endpoint.method}
                          </span>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-paynet-gray-900 mb-1">
                              {endpoint.summary || `${endpoint.method} ${endpoint.path.split('/').pop()}`}
                            </div>
                            <div className="text-xs text-paynet-gray-500 font-mono">
                              {endpoint.method} {endpoint.path}
                            </div>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-paynet-gray-400 transition-transform ${
                        activeEndpoint === endpoint.id && !ecommerceOverviewActive && !serverServerOverviewActive ? 'rotate-90' : 'group-hover:translate-x-1'
                      }`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="mb-3">
              <button
                onClick={() => {
                  setIsClientModelOpen((prev) => !prev);
                  onClientServerOverviewSelect();
                }}
                className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                  clientServerOverviewActive
                    ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                    : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-paynet-gray-900">Client-Server Model</span>
                  <ChevronRight className={`w-4 h-4 text-paynet-gray-500 transition-transform ${isClientModelOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>
            </div>
            {isClientModelOpen && (
              <div className="space-y-1 pl-3 mb-3">
                <button
                  onClick={onClientServerOrderRequestSelect}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    clientServerOrderRequestActive
                      ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                      : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-1 rounded-md font-semibold bg-blue-100 text-blue-700">
                      POST
                    </span>
                    <div className="text-sm font-medium text-paynet-gray-900">Order request v0.5</div>
                  </div>
                </button>
                <button
                  onClick={onClientServerNotificationSelect}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    clientServerNotificationActive
                      ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                      : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-1 rounded-md font-semibold bg-blue-100 text-blue-700">
                      POST
                    </span>
                    <div className="text-sm font-medium text-paynet-gray-900">Notification</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {filteredEndpoints.length === 0 && (
          <div className="text-sm text-paynet-gray-500 px-3 py-2 bg-white rounded-lg">
            No endpoints found
          </div>
        )}
      </nav>
      )}
      
      {activeView === 'project-info' && (
        <div className="p-4 flex-1 overflow-y-auto min-h-0 bg-paynet-gray-50">
          <div className="text-center py-8">
            <Book className="w-16 h-16 text-paynet-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-paynet-gray-900 mb-2">{t.common.projectInfo}</h3>
            <p className="text-paynet-gray-600 text-sm">
              {t.welcome.subtitle}
            </p>
            
            {/* Download PDF Link */}
            <div className="mt-6">
              <a
                href="paynet.ecom.api.V1.pdf"
                download="paynet.ecom.api.V1.pdf"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-paynet-primary hover:text-paynet-secondary hover:bg-paynet-light rounded-lg transition-all duration-200 border border-paynet-gray-200 hover:border-paynet-primary bg-white"
              >
                <Download className="w-4 h-4" />
                Download PDF Documentation
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};