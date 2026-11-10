import React from 'react';
import { Search, ChevronRight, Download, Wrench, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NAV_GROUPS, FALLBACK_ICON } from '../content/sidebarNav';
import { OpenAPISpec, ServiceCategory } from '../types/api';
import { Language } from '../types/language';
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

  // Ready-made Postman files, generated at build time by scripts/build-postman.mjs.
  const postmanFile = (name: string) => `${import.meta.env.BASE_URL}postman/${name}`;

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
  const iconLabel = (Icon: LucideIcon, label: string, fullTitle?: string) => (
    <span className="flex items-center gap-3" title={fullTitle && fullTitle !== label ? fullTitle : undefined}>
      <Icon className="w-4 h-4 flex-shrink-0 text-paynet-gray-500" strokeWidth={1.75} />
      <span>{label}</span>
    </span>
  );

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
      'pl-10'
    );

  const apiMethodsBlock = (
    <div className="pl-7">
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
    <div className="w-full md:w-72 lg:w-80 h-full bg-paynet-gray-50 border-r border-paynet-gray-200 flex flex-col md:flex-shrink-0 min-h-0">
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
        <a
          href={postmanFile('paynet-ecom.postman_collection.json')}
          download
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-paynet-primary bg-white border border-paynet-gray-200 hover:bg-paynet-light rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Postman collection
        </a>
        <div className="mt-1.5 flex flex-wrap justify-center gap-x-2 text-xs text-paynet-gray-500">
          <span>{ui.postmanEnvironments}:</span>
          <a href={postmanFile('paynet-test.postman_environment.json')} download className="text-paynet-primary hover:underline">TEST</a>
          <a href={postmanFile('paynet-production.postman_environment.json')} download className="text-paynet-primary hover:underline">PRODUCTION</a>
          <button type="button" onClick={() => navigate('#/guides/testing')} className="text-paynet-primary hover:underline">{ui.postmanHowTo}</button>
        </div>
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
          <div className="space-y-6">
            {NAV_GROUPS.map((group, groupIndex) => {
              const allGuides = SECTIONS.flatMap((section) => getSectionGuides(language, section.id));
              const listed = new Set(NAV_GROUPS.flatMap((g) => g.items.map((item) => (item.kind === 'guide' ? item.slug : ''))));
              // Guides not listed in NAV_GROUPS are shown in the last group, so no page can disappear.
              const extra = groupIndex === NAV_GROUPS.length - 1 ? allGuides.filter((guide) => !listed.has(guide.slug)) : [];
              return (
                <div key={group.id}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-paynet-gray-500 mb-2 px-3">
                    {group.title[language]}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      if (item.kind === 'home') {
                        return (
                          <React.Fragment key="home">
                            {navItem(iconLabel(item.icon, item.label[language]), route.kind === 'home', () => navigate('#/'))}
                          </React.Fragment>
                        );
                      }
                      if (item.kind === 'page') {
                        return (
                          <React.Fragment key={item.page}>
                            {navItem(iconLabel(item.icon, item.label[language]), isPage(item.page), () => navigate(`#/page/${item.page}`))}
                          </React.Fragment>
                        );
                      }
                      const guide = allGuides.find((g) => g.slug === item.slug);
                      if (!guide) return null;
                      return (
                        <React.Fragment key={item.slug}>
                          {navItem(iconLabel(item.icon, item.label[language], guide.title), isGuide(item.slug), () => navigate(`#/guides/${item.slug}`))}
                          {item.slug === 'notifications' && toolItem(ui.notificationSimulator, 'notification-simulator')}
                          {item.slug === 'server-to-server' && apiMethodsBlock}
                          {item.slug === 'hosted-checkout' && toolItem(ui.checkoutForm, 'checkout-form')}
                        </React.Fragment>
                      );
                    })}
                    {extra.map((guide) => (
                      <React.Fragment key={guide.slug}>
                        {navItem(iconLabel(FALLBACK_ICON, guide.title), isGuide(guide.slug), () => navigate(`#/guides/${guide.slug}`))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </nav>
    </div>
  );
};
