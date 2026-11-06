import React from 'react';
import { Search, ChevronRight, Book, Download, BookOpen } from 'lucide-react';
import { OpenAPISpec, ServiceCategory } from '../types/api';
import { TranslationResources } from '../types/language';
import { buildPostmanCollectionFromOpenApi } from '../utils/postmanCollection';

interface SidebarProps {
  categories: ServiceCategory[];
  currentSpec: OpenAPISpec | null;
  activeEndpoint: string;
  activeView: 'endpoints' | 'project-info';
  onEndpointSelect: (endpointId: string) => void;
  onViewChange: (view: 'endpoints' | 'project-info') => void;
  onEcommerceOverviewSelect: () => void;
  onServerServerOverviewSelect: () => void;
  onClientServerOverviewSelect: () => void;
  onPluginsOverviewSelect: () => void;
  onClientServerOrderRequestSelect: () => void;
  onClientServerOrderRequestV06Select: () => void;
  onClientServerNotificationSelect: () => void;
  ecommerceOverviewActive: boolean;
  serverServerOverviewActive: boolean;
  clientServerOverviewActive: boolean;
  pluginsOverviewActive: boolean;
  clientServerOrderRequestActive: boolean;
  clientServerOrderRequestV06Active: boolean;
  clientServerNotificationActive: boolean;
  guides: Array<{ slug: string; title: string }>;
  activeGuide: string | null;
  onGuideSelect: (slug: string) => void;
  guidesTitle: string;
  notificationsLabel: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  t: TranslationResources;
}

export const Sidebar: React.FC<SidebarProps> = ({
  categories,
  currentSpec,
  activeEndpoint,
  activeView,
  onEndpointSelect,
  onViewChange,
  onEcommerceOverviewSelect,
  onServerServerOverviewSelect,
  onClientServerOverviewSelect,
  onPluginsOverviewSelect,
  onClientServerOrderRequestSelect,
  onClientServerOrderRequestV06Select,
  onClientServerNotificationSelect,
  ecommerceOverviewActive,
  serverServerOverviewActive,
  clientServerOverviewActive,
  pluginsOverviewActive,
  clientServerOrderRequestActive,
  clientServerOrderRequestV06Active,
  clientServerNotificationActive,
  guides,
  activeGuide,
  onGuideSelect,
  guidesTitle,
  notificationsLabel,
  searchQuery,
  onSearchChange,
  t,
}) => {
  type SearchGroup = 'Pages' | 'Fields' | 'Endpoints';
  type SearchResult = {
    id: string;
    group: SearchGroup;
    title: string;
    subtitle?: string;
    keywords: string[];
    onSelect: () => void;
    active?: boolean;
    method?: string;
    score?: number;
  };

  const [isEcommerceOpen, setIsEcommerceOpen] = React.useState(true);
  const [isClientModelOpen, setIsClientModelOpen] = React.useState(false);
  const [isServerModelOpen, setIsServerModelOpen] = React.useState(false);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const handleDownloadPostmanCollection = () => {
    if (!currentSpec) return;

    const collection = buildPostmanCollectionFromOpenApi(currentSpec);
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'ecommerce-postman-collection.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const filteredEndpoints = categories
    .flatMap((category) => category.endpoints)
    .filter((endpoint) =>
      endpoint.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const pageSearchItems: SearchResult[] = [
    ...guides.map((guide) => ({
      id: `guide-${guide.slug}`,
      group: 'Pages' as const,
      title: guide.title,
      subtitle: guidesTitle,
      keywords: [guide.slug.replace(/-/g, ' '), 'guide'],
      onSelect: () => onGuideSelect(guide.slug),
      active: activeGuide === guide.slug,
    })),
    {
      id: 'page-ecommerce',
      group: 'Pages',
      title: 'Ecommerce',
      keywords: ['overview', 'ecommerce', 'main'],
      onSelect: onEcommerceOverviewSelect,
      active: ecommerceOverviewActive,
    },
    {
      id: 'page-server-server',
      group: 'Pages',
      title: 'Server-Server model',
      keywords: ['server server', 'model', 'overview'],
      onSelect: onServerServerOverviewSelect,
      active: serverServerOverviewActive,
    },
    {
      id: 'page-client-server',
      group: 'Pages',
      title: 'Client-Server model',
      keywords: ['client server', 'model', 'overview'],
      onSelect: onClientServerOverviewSelect,
      active: clientServerOverviewActive,
    },
    {
      id: 'page-plugins',
      group: 'Pages',
      title: 'Plugins',
      keywords: ['plugins', 'shopify', 'wordpress', 'magento', 'download'],
      onSelect: onPluginsOverviewSelect,
      active: pluginsOverviewActive,
    },
    {
      id: 'page-order-v05',
      group: 'Pages',
      title: 'Order request v0.5 (old)',
      keywords: ['order', 'request', 'v0.5', 'setecom'],
      onSelect: onClientServerOrderRequestSelect,
      active: clientServerOrderRequestActive,
    },
    {
      id: 'page-order-v06',
      group: 'Pages',
      title: 'Order request v0.6',
      keywords: ['order', 'request', 'v0.6', 'checkout'],
      onSelect: onClientServerOrderRequestV06Select,
      active: clientServerOrderRequestV06Active,
    },
    {
      id: 'page-notification',
      group: 'Pages',
      title: notificationsLabel,
      keywords: ['callback', 'notification', 'webhook', 'hash'],
      onSelect: onClientServerNotificationSelect,
      active: clientServerNotificationActive,
    },
  ];

  const fieldSearchItems: SearchResult[] = [
    {
      id: 'field-signature',
      group: 'Fields',
      title: 'Signature',
      subtitle: 'Order request v0.6',
      keywords: ['hash', 'md5', 'base64', 'signature'],
      onSelect: onClientServerOrderRequestV06Select,
    },
    {
      id: 'field-order',
      group: 'Fields',
      title: 'Order',
      subtitle: 'Order request v0.6',
      keywords: ['order', 'externalid', 'id'],
      onSelect: onClientServerOrderRequestV06Select,
    },
    {
      id: 'field-money-type',
      group: 'Fields',
      title: 'MoneyType',
      subtitle: 'Order request v0.6',
      keywords: ['moneytype', 'card', 'payment type'],
      onSelect: onClientServerOrderRequestV06Select,
    },
    {
      id: 'field-customer-email',
      group: 'Fields',
      title: 'CustomerEmail',
      subtitle: 'Order request v0.6',
      keywords: ['email', 'customer', 'payer'],
      onSelect: onClientServerOrderRequestV06Select,
    },
    {
      id: 'field-product-quantity',
      group: 'Fields',
      title: 'ProductQuantity',
      subtitle: 'Order request v0.6',
      keywords: ['product', 'quantity', 'items'],
      onSelect: onClientServerOrderRequestV06Select,
    },
    {
      id: 'field-signature-v05',
      group: 'Fields',
      title: 'PreparedString signature',
      subtitle: 'Order request v0.5 (old)',
      keywords: ['preparedstring', 'v05', 'signature'],
      onSelect: onClientServerOrderRequestSelect,
    },
  ];

  const endpointSearchItems: SearchResult[] = categories.flatMap((category) =>
    category.endpoints.map((endpoint) => ({
      id: `endpoint-${endpoint.id}`,
      group: 'Endpoints' as const,
      title: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
      subtitle: `${endpoint.method} ${endpoint.path}`,
      keywords: [endpoint.path, endpoint.method, category.name].filter(Boolean),
      method: endpoint.method,
      onSelect: () => onEndpointSelect(endpoint.id),
      active: activeEndpoint === endpoint.id && !ecommerceOverviewActive && !serverServerOverviewActive,
    })),
  );

  const scoreSearchResult = (item: SearchResult, query: string) => {
    const title = item.title.toLowerCase();
    const subtitle = (item.subtitle || '').toLowerCase();
    const keywords = item.keywords.join(' ').toLowerCase();
    const fullText = `${title} ${subtitle} ${keywords}`;

    if (!fullText.includes(query)) return 0;
    if (title === query) return 200;
    if (title.startsWith(query)) return 140;
    if (title.includes(query)) return 100;
    if (keywords.includes(query)) return 80;
    return 60;
  };

  const groupedSearchResults = React.useMemo(() => {
    if (!normalizedQuery) return { Pages: [], Fields: [], Endpoints: [] } as Record<SearchGroup, SearchResult[]>;

    const allItems = [...pageSearchItems, ...fieldSearchItems, ...endpointSearchItems];
    const matched = allItems
      .map((item) => ({ ...item, score: scoreSearchResult(item, normalizedQuery) }))
      .filter((item) => (item.score || 0) > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const grouped: Record<SearchGroup, SearchResult[]> = { Pages: [], Fields: [], Endpoints: [] };
    matched.forEach((item) => {
      if (grouped[item.group].length < 8) grouped[item.group].push(item);
    });
    return grouped;
  }, [normalizedQuery, categories, activeEndpoint, ecommerceOverviewActive, serverServerOverviewActive, guides, activeGuide]);

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
        
        {/* Project Info toggle is temporarily hidden in UI; keep endpoint access only. */}
        <div className="flex mb-4 bg-paynet-gray-100 rounded-lg p-1">
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
        
        {currentSpec && (
          <button
            type="button"
            onClick={handleDownloadPostmanCollection}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-paynet-primary bg-white border border-paynet-gray-200 hover:bg-paynet-light rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Postman collection
          </button>
        )}
        </>
        )}
      </div>

      {activeView === 'endpoints' && (
      <nav className="p-4 flex-1 overflow-y-auto min-h-0 bg-paynet-gray-50">
        {normalizedQuery && (
          <div className="space-y-4">
            {(Object.keys(groupedSearchResults) as SearchGroup[]).map((groupName) => (
              groupedSearchResults[groupName].length > 0 && (
                <div key={groupName}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-paynet-gray-500 mb-2 px-1">
                    {groupName}
                  </div>
                  <div className="space-y-1">
                    {groupedSearchResults[groupName].map((item) => (
                      <button
                        key={item.id}
                        onClick={item.onSelect}
                        className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                          item.active
                            ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                            : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-paynet-gray-900 truncate">
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div className="text-xs text-paynet-gray-500 truncate">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                          {item.method && (
                            <span className={`text-[10px] font-mono px-2 py-1 rounded-md font-semibold ${
                              item.method === 'GET' ? 'bg-green-100 text-green-700' :
                              item.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                              item.method === 'PUT' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {item.method}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}

            {groupedSearchResults.Pages.length === 0 &&
              groupedSearchResults.Fields.length === 0 &&
              groupedSearchResults.Endpoints.length === 0 && (
                <div className="text-sm text-paynet-gray-500 px-3 py-2 bg-white rounded-lg">
                  No results found
                </div>
              )}
          </div>
        )}

        {!normalizedQuery && (
        <>
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-paynet-gray-500 mb-2 px-1">
            <BookOpen className="w-3.5 h-3.5" />
            {guidesTitle}
          </div>
          <div className="space-y-1">
            {guides.map((guide) => (
              <button
                key={guide.slug}
                type="button"
                onClick={() => onGuideSelect(guide.slug)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  activeGuide === guide.slug
                    ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg font-semibold text-paynet-gray-900'
                    : 'text-paynet-gray-700 hover:bg-paynet-light'
                }`}
              >
                {guide.title}
              </button>
            ))}
          </div>
        </div>
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
                    <div className="text-sm font-medium text-paynet-gray-900">Order request v0.5 (old)</div>
                  </div>
                </button>
                <button
                  onClick={onClientServerOrderRequestV06Select}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    clientServerOrderRequestV06Active
                      ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                      : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-1 rounded-md font-semibold bg-blue-100 text-blue-700">
                      POST
                    </span>
                    <div className="text-sm font-medium text-paynet-gray-900">Order request v0.6</div>
                  </div>
                </button>
              </div>
            )}

            <div className="mb-3">
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
                  <div className="text-sm font-semibold text-paynet-gray-900">{notificationsLabel}</div>
                </div>
              </button>
            </div>
            <div className="mb-3">
              <button
                onClick={onPluginsOverviewSelect}
                className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                  pluginsOverviewActive
                    ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                    : 'bg-white hover:bg-paynet-light hover:shadow-paynet'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-paynet-gray-900">Plugins</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {filteredEndpoints.length === 0 && (
          <div className="text-sm text-paynet-gray-500 px-3 py-2 bg-white rounded-lg">
            No endpoints found
          </div>
        )}
        </>
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