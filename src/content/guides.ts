import { Language } from '../types/language';

/**
 * Guides are plain Markdown files in /content/<language>/NN-slug.md.
 * The same files feed the AI documentation (scripts/build-ai-docs.mjs),
 * so the portal and llms-full.txt never drift apart.
 */
const files = import.meta.glob('../../content/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface Guide {
  slug: string;
  order: number;
  title: string;
  source: string;
}

const byLanguage: Record<string, Guide[]> = {};

Object.entries(files).forEach(([filePath, source]) => {
  const match = filePath.match(/content\/([a-z]{2})\/(\d+)-([a-z0-9-]+)\.md$/);
  if (!match) return;
  const [, language, order, slug] = match;
  const title = (source.match(/^#\s+(.+)$/m)?.[1] || slug).trim();
  if (!byLanguage[language]) byLanguage[language] = [];
  byLanguage[language].push({ slug, order: Number(order), title, source });
});

Object.values(byLanguage).forEach((list) => list.sort((a, b) => a.order - b.order));

export const getGuides = (language: Language): Guide[] => byLanguage[language] || byLanguage.en || [];

export const getGuide = (language: Language, slug: string): Guide | undefined =>
  getGuides(language).find((guide) => guide.slug === slug) || (byLanguage.en || []).find((guide) => guide.slug === slug);

export const DEFAULT_GUIDE = 'getting-started';

export const guideUiText: Record<Language, {
  section: string;
  copyForAi: string;
  copied: string;
  openMarkdown: string;
  forAi: string;
  forAiHint: string;
  previous: string;
  next: string;
  notifications: string;
}> = {
  en: {
    section: 'Guides',
    copyForAi: 'Copy for AI',
    copied: 'Copied',
    openMarkdown: 'Markdown',
    forAi: 'Docs for AI',
    forAiHint: 'Whole documentation as one text file for ChatGPT, Claude, Gemini and other assistants',
    previous: 'Previous',
    next: 'Next',
    notifications: 'Notifications (webhooks)',
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
    notifications: 'Уведомления (webhooks)',
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
    notifications: 'Notificări (webhooks)',
  },
};
