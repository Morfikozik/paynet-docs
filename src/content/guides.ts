import { Language } from '../types/language';

/**
 * Guides are plain Markdown files in /content/<language>/<section>/NN-slug.md.
 * The same files feed the AI documentation (scripts/build-ai-docs.mjs),
 * so the portal and llms-full.txt never drift apart.
 *
 * Sections: "common" (topics shared by all products) and one folder per product
 * ("ecom" today; payouts, cashout, ... later). A new product = a new folder
 * plus an entry in SECTIONS below.
 */
const files = import.meta.glob('../../content/*/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export type SectionId = 'common' | 'ecom';

export interface Guide {
  slug: string;
  section: SectionId;
  order: number;
  title: string;
  source: string;
}

export const SECTIONS: Array<{ id: SectionId; title: Record<Language, string> }> = [
  { id: 'common', title: { en: 'General', ru: 'Общее', ro: 'General' } },
  { id: 'ecom', title: { en: 'E-commerce', ru: 'E-commerce', ro: 'E-commerce' } },
];

const byLanguage: Record<string, Guide[]> = {};

Object.entries(files).forEach(([filePath, source]) => {
  const match = filePath.match(/content\/([a-z]{2})\/([a-z]+)\/(\d+)-([a-z0-9-]+)\.md$/);
  if (!match) return;
  const [, language, section, order, slug] = match;
  const title = (source.match(/^#\s+(.+)$/m)?.[1] || slug).trim();
  if (!byLanguage[language]) byLanguage[language] = [];
  byLanguage[language].push({ slug, section: section as SectionId, order: Number(order), title, source });
});

const sectionIndex = (id: SectionId) => SECTIONS.findIndex((section) => section.id === id);

Object.values(byLanguage).forEach((list) =>
  list.sort((a, b) => sectionIndex(a.section) - sectionIndex(b.section) || a.order - b.order)
);

export const getGuides = (language: Language): Guide[] => byLanguage[language] || byLanguage.en || [];

export const getSectionGuides = (language: Language, section: SectionId): Guide[] =>
  getGuides(language).filter((guide) => guide.section === section);

export const getGuide = (language: Language, slug: string): Guide | undefined =>
  getGuides(language).find((guide) => guide.slug === slug) || (byLanguage.en || []).find((guide) => guide.slug === slug);

export const DEFAULT_GUIDE = 'getting-started';

/** Plain text of a guide for full-text search (code blocks and Markdown markup removed). */
export const guidePlainText = (source: string) =>
  source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*[-*]\s+\[[ x]\]\s+/gim, ' ')
    .replace(/[#>*`|]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

type UiText = {
  section: string;
  copyForAi: string;
  copied: string;
  openMarkdown: string;
  forAi: string;
  forAiHint: string;
  previous: string;
  next: string;
  home: string;
  apiMethods: string;
  checkoutForm: string;
  notificationSimulator: string;
  plugins: string;
  postmanEnvironments: string;
  postmanHowTo: string;
  searchPlaceholder: string;
  searchGuides: string;
  searchMethods: string;
  searchTools: string;
  noResults: string;
  homeTitle: string;
  homeSubtitle: string;
  homeProducts: string;
  homeGeneral: string;
  homeEnvironments: string;
  quickStart: string;
  apiReference: string;
  ecomCardText: string;
  ecomLinks: { label: string; hash: string }[];
  testEnv: string;
  prodEnv: string;
  envApi: string;
  envCheckout: string;
};

export const guideUiText: Record<Language, UiText> = {
  en: {
    section: 'Guides',
    copyForAi: 'Copy for AI',
    copied: 'Copied',
    openMarkdown: 'Markdown',
    forAi: 'Docs for AI',
    forAiHint: 'Whole documentation as one text file for ChatGPT, Claude, Gemini and other assistants',
    previous: 'Previous',
    next: 'Next',
    home: 'Home',
    apiMethods: 'API methods (try it)',
    checkoutForm: 'Checkout form (try it)',
    notificationSimulator: 'Notification simulator',
    plugins: 'Plugins',
    postmanEnvironments: 'Environments',
    postmanHowTo: 'How to use',
    searchPlaceholder: 'Search the documentation…',
    searchGuides: 'Guides',
    searchMethods: 'API methods',
    searchTools: 'Tools',
    noResults: 'No results found',
    homeTitle: 'Paynet for developers',
    homeSubtitle: 'Everything you need to connect to Paynet: guides, API reference with an online tester, and documentation ready for AI assistants.',
    homeProducts: 'Products',
    homeGeneral: 'General topics',
    homeEnvironments: 'Environments',
    quickStart: 'Quick start',
    apiReference: 'API methods',
    ecomCardText: 'Accept online payments by card, Apple Pay, Google Pay, Paynet wallet, MIA and cash invoice on a Paynet-hosted payment page.',
    ecomLinks: [
      { label: 'Integration options', hash: '#/guides/integration-options' },
      { label: 'Quick start', hash: '#/guides/getting-started' },
      { label: 'Server-to-server', hash: '#/guides/server-to-server' },
      { label: 'Hosted checkout', hash: '#/guides/hosted-checkout' },
      { label: 'Plugins', hash: '#/page/plugins' },
    ],
    testEnv: 'Test',
    prodEnv: 'Production',
    envApi: 'E-commerce API',
    envCheckout: 'Hosted checkout form',
  },
  ru: {
    section: 'Руководства',
    copyForAi: 'Копировать для ИИ',
    copied: 'Скопировано',
    openMarkdown: 'Markdown',
    forAi: 'Документация для ИИ',
    forAiHint: 'Вся документация одним текстовым файлом для ChatGPT, Claude, Gemini и других ассистентов',
    previous: 'Назад',
    next: 'Далее',
    home: 'Главная',
    apiMethods: 'Методы API (попробовать)',
    checkoutForm: 'Форма checkout (попробовать)',
    notificationSimulator: 'Симулятор уведомлений',
    plugins: 'Плагины',
    postmanEnvironments: 'Окружения',
    postmanHowTo: 'Как пользоваться',
    searchPlaceholder: 'Поиск по документации…',
    searchGuides: 'Руководства',
    searchMethods: 'Методы API',
    searchTools: 'Инструменты',
    noResults: 'Ничего не найдено',
    homeTitle: 'Paynet для разработчиков',
    homeSubtitle: 'Всё, что нужно для подключения к Paynet: руководства, справочник API с онлайн-тестером и документация, готовая для ИИ-ассистентов.',
    homeProducts: 'Продукты',
    homeGeneral: 'Общие темы',
    homeEnvironments: 'Окружения',
    quickStart: 'Быстрый старт',
    apiReference: 'Методы API',
    ecomCardText: 'Приём онлайн-платежей картой, Apple Pay, Google Pay, кошельком Paynet, MIA и наличными по счёту на платёжной странице Paynet.',
    ecomLinks: [
      { label: 'Варианты интеграции', hash: '#/guides/integration-options' },
      { label: 'Быстрый старт', hash: '#/guides/getting-started' },
      { label: 'Server-to-server', hash: '#/guides/server-to-server' },
      { label: 'Hosted checkout', hash: '#/guides/hosted-checkout' },
      { label: 'Плагины', hash: '#/page/plugins' },
    ],
    testEnv: 'Тест',
    prodEnv: 'Продакшн',
    envApi: 'E-commerce API',
    envCheckout: 'Форма hosted checkout',
  },
  ro: {
    section: 'Ghiduri',
    copyForAi: 'Copiază pentru AI',
    copied: 'Copiat',
    openMarkdown: 'Markdown',
    forAi: 'Documentație pentru AI',
    forAiHint: 'Toată documentația într-un singur fișier text pentru ChatGPT, Claude, Gemini și alți asistenți',
    previous: 'Înapoi',
    next: 'Înainte',
    home: 'Acasă',
    apiMethods: 'Metode API (încercați)',
    checkoutForm: 'Formular checkout (încercați)',
    notificationSimulator: 'Simulator notificări',
    plugins: 'Pluginuri',
    postmanEnvironments: 'Medii',
    postmanHowTo: 'Cum se folosește',
    searchPlaceholder: 'Căutați în documentație…',
    searchGuides: 'Ghiduri',
    searchMethods: 'Metode API',
    searchTools: 'Instrumente',
    noResults: 'Niciun rezultat',
    homeTitle: 'Paynet pentru dezvoltatori',
    homeSubtitle: 'Tot ce aveți nevoie pentru conectarea la Paynet: ghiduri, referința API cu tester online și documentație pregătită pentru asistenții AI.',
    homeProducts: 'Produse',
    homeGeneral: 'Subiecte generale',
    homeEnvironments: 'Medii',
    quickStart: 'Primii pași',
    apiReference: 'Metode API',
    ecomCardText: 'Acceptați plăți online cu cardul, Apple Pay, Google Pay, portofelul Paynet, MIA și factură cu plată în numerar pe pagina de plată Paynet.',
    ecomLinks: [
      { label: 'Opțiuni de integrare', hash: '#/guides/integration-options' },
      { label: 'Primii pași', hash: '#/guides/getting-started' },
      { label: 'Server-to-server', hash: '#/guides/server-to-server' },
      { label: 'Hosted checkout', hash: '#/guides/hosted-checkout' },
      { label: 'Pluginuri', hash: '#/page/plugins' },
    ],
    testEnv: 'Test',
    prodEnv: 'Producție',
    envApi: 'E-commerce API',
    envCheckout: 'Formular hosted checkout',
  },
};
