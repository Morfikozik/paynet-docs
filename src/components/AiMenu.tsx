import React from 'react';
import { Bot, Check, ChevronDown, Copy, ExternalLink, FileText, Plug, Sparkles } from 'lucide-react';
import { Language } from '../types/language';

/**
 * "Copy for AI" button with a dropdown: copy the page as Markdown, view the Markdown file,
 * open the page in ChatGPT / Claude / Gemini, or go to the instructions for connecting
 * an AI assistant in the editor (Cursor, VS Code, Claude Code, Codex).
 */
interface AiMenuProps {
  language: Language;
  /** Page title, used in the prompt for chat assistants. */
  title: string;
  /** Markdown file of this page, relative to the site root (e.g. docs/ru/signatures.md). */
  markdownPath: string;
  /** Language of the Markdown file, shown next to "View as Markdown". */
  markdownLanguage: string;
  /** Markdown text to copy; if omitted, the file at markdownPath is fetched. */
  markdown?: string;
  onNavigate: (href: string) => void;
}

const TEXT = {
  en: {
    button: 'Copy for AI',
    copied: 'Copied',
    more: 'More AI options',
    copyPage: 'Copy page',
    copyPageHint: 'Markdown for ChatGPT, Claude, Gemini…',
    view: 'View as Markdown',
    viewHint: 'This page as plain text',
    openIn: (name: string) => `Open in ${name}`,
    openHint: 'Ask about this page',
    geminiHint: 'Prompt is copied: paste it in Gemini',
    connect: 'Connect an AI assistant',
    connectHint: 'Cursor, VS Code, Claude Code, Codex',
    prompt: (title: string, url: string, all: string) =>
      `Read the Paynet developer documentation page "${title}": ${url}\nFull documentation: ${all}\nThen help me with my integration. Use only this documentation as the source of truth.`,
  },
  ru: {
    button: 'Копировать для ИИ',
    copied: 'Скопировано',
    more: 'Другие действия для ИИ',
    copyPage: 'Копировать страницу',
    copyPageHint: 'Markdown для ChatGPT, Claude, Gemini…',
    view: 'Открыть как Markdown',
    viewHint: 'Эта страница простым текстом',
    openIn: (name: string) => `Открыть в ${name}`,
    openHint: 'Задать вопрос по этой странице',
    geminiHint: 'Запрос скопирован: вставьте его в Gemini',
    connect: 'Подключить ИИ-помощника',
    connectHint: 'Cursor, VS Code, Claude Code, Codex',
    prompt: (title: string, url: string, all: string) =>
      `Прочитай страницу документации Paynet для разработчиков «${title}»: ${url}\nПолная документация: ${all}\nЗатем помоги мне с интеграцией. Используй только эту документацию как источник. Отвечай на русском.`,
  },
  ro: {
    button: 'Copiază pentru AI',
    copied: 'Copiat',
    more: 'Alte acțiuni pentru AI',
    copyPage: 'Copiază pagina',
    copyPageHint: 'Markdown pentru ChatGPT, Claude, Gemini…',
    view: 'Deschide ca Markdown',
    viewHint: 'Această pagină ca text simplu',
    openIn: (name: string) => `Deschide în ${name}`,
    openHint: 'Întreabă despre această pagină',
    geminiHint: 'Cererea e copiată: lipește-o în Gemini',
    connect: 'Conectează un asistent AI',
    connectHint: 'Cursor, VS Code, Claude Code, Codex',
    prompt: (title: string, url: string, all: string) =>
      `Citește pagina de documentație Paynet pentru dezvoltatori „${title}”: ${url}\nDocumentația completă: ${all}\nApoi ajută-mă cu integrarea. Folosește doar această documentație ca sursă. Răspunde în română.`,
  },
} as const;

const siteBase = () => window.location.href.split('#')[0].replace(/[^/]*$/, '');

export const AiMenu: React.FC<AiMenuProps> = ({ language, title, markdownPath, markdownLanguage, markdown, onNavigate }) => {
  const text = TEXT[language] || TEXT.en;
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [fetched, setFetched] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const markdownUrl = new URL(markdownPath, siteBase()).href;
  const fullUrl = new URL('llms-full.txt', siteBase()).href;
  const prompt = text.prompt(title, markdownUrl, fullUrl);

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Pages without inline Markdown (API methods): load the file in advance so copying is instant.
  React.useEffect(() => {
    setFetched(null);
    if (markdown !== undefined) return;
    let cancelled = false;
    fetch(markdownPath)
      .then((response) => (response.ok ? response.text() : null))
      .then((body) => !cancelled && setFetched(body))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [markdownPath, markdown]);

  const pageText = () => {
    const body = markdown ?? fetched ?? `${title}\n${markdownUrl}`;
    return `${body}\n\n---\nSource: ${markdownUrl}\nFull documentation for AI assistants: ${fullUrl}\n`;
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const item = (
    key: string,
    icon: React.ReactNode,
    label: string,
    hint: string,
    onClick: () => void,
    external = false,
  ) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-3 py-2 rounded-md text-left hover:bg-paynet-light transition-colors"
    >
      <span className="mt-0.5 text-paynet-gray-600">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-medium text-paynet-gray-900">
          {label}
          {external && <ExternalLink className="w-3 h-3 text-paynet-gray-400" />}
        </span>
        <span className="block text-xs text-paynet-gray-500">{hint}</span>
      </span>
    </button>
  );

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => copy(pageText())}
        className="inline-flex items-center gap-1.5 text-sm font-medium pl-3 pr-2.5 py-1.5 rounded-l-paynet border border-paynet-primary text-paynet-primary bg-white hover:bg-paynet-light transition-colors"
      >
        {copied ? <Check className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        {copied ? text.copied : text.button}
      </button>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={text.more}
        title={text.more}
        className="inline-flex items-center px-2 py-1.5 rounded-r-paynet border border-l-0 border-paynet-primary text-paynet-primary bg-white hover:bg-paynet-light transition-colors"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-80 z-30 bg-white border border-paynet-gray-200 rounded-paynet shadow-lg p-1.5"
        >
          {item('copy', <Copy className="w-4 h-4" />, text.copyPage, text.copyPageHint, () => {
            copy(pageText());
            setOpen(false);
          })}
          {item('view', <FileText className="w-4 h-4" />, `${text.view} (${markdownLanguage})`, text.viewHint, () => openUrl(markdownPath), true)}
          <div className="my-1 border-t border-paynet-gray-100" />
          {item('chatgpt', <Sparkles className="w-4 h-4" />, text.openIn('ChatGPT'), text.openHint, () =>
            openUrl(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`), true)}
          {item('claude', <Sparkles className="w-4 h-4" />, text.openIn('Claude'), text.openHint, () =>
            openUrl(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`), true)}
          {item('gemini', <Sparkles className="w-4 h-4" />, text.openIn('Gemini'), text.geminiHint, () => {
            copy(prompt);
            openUrl('https://gemini.google.com/app');
          }, true)}
          <div className="my-1 border-t border-paynet-gray-100" />
          {item('connect', <Plug className="w-4 h-4" />, text.connect, text.connectHint, () => {
            setOpen(false);
            onNavigate('#/guides/ai-assistants');
          })}
        </div>
      )}
    </div>
  );
};
