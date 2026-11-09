import React from 'react';
import { Search, ChevronRight, Download, Home, Wrench, X } from 'lucide-react';
import { OpenAPISpec, ServiceCategory } from '../types/api';
import { Language } from '../types/language';
import { buildPostmanCollectionFromOpenApi } from '../utils/postmanCollection';
import { getMethodTranslation } from '../utils/pathTranslations';
import { SECTIONS, getSectionGuides, guidePlainText, guideUiText } from '../content/guides';

/** What is currently open in the content area (parsed from the URL hash). */
export type Route =
  | { kind: 'home' }
  | { kind: 'guide'; slug: string }
  | { kind: 'page'; page: 'plugins' | 'checkout-form' | 'notification-simulator' }
  | { kind: 'api'; endpointId: string };

interface SidebarProps {
  language: Language;
  categories: ServiceCategory[];
  currentSpec: OpenAPISpec | null;
  route: Route;
  navigate: (hash: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

type SearchResult = {
  id: string;
  group: 'guides' | 'methods' | 'tools';
  title: string;
  snippet?: string;
  method?: string;
  hash: string;
  score: number;
};

const methodBadge = (method: string) =>
  method === 'GET'
    ? 'bg-green-100 text-green-700'
    : method === 'POST'
      ? 'bg-blue-100 text-blue-700'
      : method === 'PUT'
        ? 'bg-orange-100 text-orange-800'
        : 'bg-red-100 text-red-800';

/** Short text fragment around the first match, for search results. */
const makeSnippet = (text: string, query: string) => {
  const index = text.toLowerCase().indexOf(query);
  if (index < 0) return undefined;
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + query.length + 70);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
};

export const Sidebar: React.FC<SidebarProps> = ({
  language,
  categories,
  currentSpec,
  route,
  navigate,
  searchQuery,
  onSearchChange,
}) => {
  const ui = guideUiText[language];
  const query = searchQuery.trim().toLowerCase();
  const endpoints = React.useMemo(() => categories.flatMap((category) => category.endpoints), [categories]);
  const [methodsOpen, setMethodsOpen] = React.useState(true);

  const endpointName = React.useCallback(
    (endpoint: { path: string; method: string; summary: string }) =>
      getMethodTranslation(endpoint.path, endpoint.method, language, endpoint.summary).name.replace(/\.$/, ''),
    [language]
  );

  const isGuide = (slug: string) => route.kind === 'guide' && route.slug === slug;
  const isPage = (page: string) => route.kind === 'page' && route.page === page;
  const isApi = (id: string) => route.kind === 'api' && route.endpointId === id;

  const handleDownloadPostmanCollection = () => {
    if (!currentSpec) return;
    const collection = buildPostmanCollectionFromOpenApi(currentSpec);
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'paynet-ecommerce-postman-collection.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  // ---------- full-text search ----------
  const searchIndex = React.useMemo(() => {
    const guides = SECTIONS.flatMap((section) =>
      getSectionGuides(language, section.id).map((guide) => ({
        id: `guide-${guide.slug}`,
        group: 'guides' as const,
        title: guide.title,
        subtitle: section.title[language],
        text: guidePlainText(guide.source),
        code: guide.source.toLowerCase(),
        hash: `#/guides/${guide.slug}`,
      }))
    );
    const methods = endpoints.map((endpoint) => {
      const translation = getMethodTranslation(endpoint.path, endpoint.method, language, endpoint.summary);
      return {
        id: `api-${endpoint.id}`,
        group: 'methods' as const,
        title: translation.name.replace(/\.$/, ''),
        subtitle: `${endpoint.method} ${endpoint.path}`,
        text: `${translation.description || ''} ${(endpoint.parameters || []).map((p) => p.name).join(' ')}`,
        code: `${endpoint.path} ${(endpoint.parameters || []).map((p) => `${p.name} ${p.description || ''}`).join(' ')}`.toLowerCase(),
        method: endpoint.method,
        hash: `#/api/${endpoint.id}`,
      };
    });
    const tools = [
      { id: 'tool-checkout', title: ui.checkoutForm, text: 'hosted checkout signature form Order Amount MoneyType', hash: '#/page/checkout-form' },
      { id: 'tool-notification', title: ui.notificationSimulator, text: 'notification webhook callback Hash PAID', hash: '#/page/notification-simulator' },
      { id: 'tool-plugins', title: ui.plugins, text: 'plugins WordPress WooCommerce OpenCart PrestaShop Magento CS-Cart Shopify Cybersource', hash: '#/page/plugins' },
    ].map((tool) => ({ ...tool, group: 'tools' as const, subtitle: '', code: tool.text.toLowerCase() }));
    return [...guides, ...methods, ...tools];
  }, [language, endpoints, ui]);

  const results = React.useMemo(() => {
    if (query.length < 2) return [] as SearchResult[];
    return searchIndex
      .map((item) => {
        const title = item.title.toLowerCase();
        const subtitle = item.subtitle.toLowerCase();
        const text = item.text.toLowerCase();
        let score = 0;
        if (title === query) score = 300;
        else if (title.startsWith(query)) score = 200;
        else if (title.includes(query)) score = 150;
        else if (subtitle.includes(query)) score = 100;
        else if (text.includes(query)) score = 60 + Math.min(20, text.split(query).length);
        else if (item.code.includes(query)) score = 40;
        return {
          id: item.id,
          group: item.group,
          title: item.title,
          snippet: score < 150 ? makeSnippet(item.text, query) || item.subtitle : item.subtitle,
          method: 'method' in item ? (item as { method?: string }).method : undefined,
          hash: item.hash,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, searchIndex]);

  const groupLabel: Record<SearchResult['group'], string> = {
    guides: ui.searchGuides,
    methods: ui.searchMethods,
    tools: ui.searchTools,
  };

  const openResult = (hash: string) => {
    navigate(hash);
    onSearchChange('');
  };

  // ---------- rendering helpers ----------
  const navItem = (label: React.ReactNode, active: boolean, onClick: () => void, extraClass = '') => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${extraClass} ${
        active
          ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg font-semibold text-paynet-gray-900'
          : 'text-paynet-gray-700 hover:bg-paynet-light'
      }`}
    >
      {label}
    </button>
  );

  const toolItem = (label: string, page: 'plugins' | 'checkout-form' | 'notification-simulator') =>
    navItem(
      <span className="inline-flex items-center gap-2">
        <Wrench className="w-3.5 h-3.5 text-paynet-primary" />
        {label}
      </span>,
      isPage(page),
      () => navigate(`#/page/${page}`),
      'pl-6'
    );

  const apiMethodsBlock = (
    <div className="pl-3">
      <button
        type="button"
        onClick={() => setMethodsOpen((open) => !open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-paynet-gray-700 hover:bg-paynet-light"
      >
        <span className="inline-flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-paynet-primary" />
          {ui.apiMethods}
        </span>
        <ChevronRight className={`w-4 h-4 text-paynet-gray-500 transition-transform ${methodsOpen ? 'rotate-90' : ''}`} />
      </button>
      {methodsOpen && (
        <div className="space-y-1 pl-3 mt-1">
          {endpoints.map((endpoint) => (
            <button
              key={endpoint.id}
              type="button"
              onClick={() => navigate(`#/api/${endpoint.id}`)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
                isApi(endpoint.id)
                  ? 'bg-white border-l-4 border-paynet-primary shadow-paynet-lg'
                  : 'hover:bg-paynet-light'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold mt-0.5 ${methodBadge(endpoint.method)}`}>
                  {endpoint.method}
                </span>
                <span className="text-sm text-paynet-gray-800 leading-snug">{endpointName(endpoint)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full md:w-72 lg:w-80 bg-paynet-gray-50 border-r border-paynet-gray-200 flex flex-col md:flex-shrink-0 max-h-[45vh] md:max-h-none">
      <div className="p-5 border-b border-paynet-gray-200 flex-shrink-0 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-paynet-gray-400 w-4 h-4" />
          <input
            type="search"
            placeholder={ui.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-3 border border-paynet-gray-300 rounded-lg focus:ring-2 focus:ring-paynet-primary focus:border-transparent transition-all duration-200 bg-white text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-paynet-gray-400 hover:text-paynet-gray-700"
              aria-label="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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
      </div>

      <nav className="p-4 flex-1 overflow-y-auto min-h-0 bg-paynet-gray-50">
        {query.length >= 2 ? (
          <div className="space-y-4">
            {(['guides', 'methods', 'tools'] as const).map((group) => {
              const items = results.filter((item) => item.group === group).slice(0, 10);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-paynet-gray-500 mb-2 px-1">
                    {groupLabel[group]}
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openResult(item.hash)}
                        className="w-full text-left p-3 rounded-lg bg-white hover:bg-paynet-light hover:shadow-paynet transition-all"
                      >
                        <div className="flex items-center gap-2">
                          {item.method && (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${methodBadge(item.method)}`}>
                              {item.method}
                            </span>
                          )}
                          <span className="text-sm font-medium text-paynet-gray-900">{item.title}</span>
                        </div>
                        {item.snippet && (
                          <div className="text-xs text-paynet-gray-500 mt-1 line-clamp-2">{item.snippet}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {results.length === 0 && (
              <div className="text-sm text-paynet-gray-500 px-3 py-2 bg-white rounded-lg">{ui.noResults}</div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {navItem(
              <span className="inline-flex items-center gap-2">
                <Home className="w-4 h-4" />
                {ui.home}
              </span>,
              route.kind === 'home',
              () => navigate('#/')
            )}

            {SECTIONS.map((section) => (
              <div key={section.id}>
                <div className="text-xs font-semibold uppercase tracking-wide text-paynet-gray-500 mb-2 px-1">
                  {section.title[language]}
                </div>
                <div className="space-y-1">
                  {getSectionGuides(language, section.id).map((guide) => (
                    <React.Fragment key={guide.slug}>
                      {navItem(guide.title, isGuide(guide.slug), () => navigate(`#/guides/${guide.slug}`))}
                      {guide.slug === 'notifications' && toolItem(ui.notificationSimulator, 'notification-simulator')}
                      {guide.slug === 'server-to-server' && apiMethodsBlock}
                      {guide.slug === 'hosted-checkout' && toolItem(ui.checkoutForm, 'checkout-form')}
                      {guide.slug === 'hosted-checkout' && navItem(ui.plugins, isPage('plugins'), () => navigate('#/page/plugins'))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
};
