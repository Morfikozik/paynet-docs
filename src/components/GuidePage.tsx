import React from 'react';
import { ArrowLeft, ArrowRight, Bot, Check, FileText } from 'lucide-react';
import { Markdown } from './Markdown';
import { Guide, getGuides, guideUiText } from '../content/guides';
import { Language } from '../types/language';

interface GuidePageProps {
  guide: Guide;
  language: Language;
  onNavigate: (href: string) => void;
}

export const GuidePage: React.FC<GuidePageProps> = ({ guide, language, onNavigate }) => {
  const ui = guideUiText[language];
  const [copied, setCopied] = React.useState(false);
  const guides = getGuides(language);
  const index = guides.findIndex((item) => item.slug === guide.slug);
  const previous = index > 0 ? guides[index - 1] : null;
  const next = index >= 0 && index < guides.length - 1 ? guides[index + 1] : null;

  const copyForAi = async () => {
    const pageUrl = window.location.href;
    const text = `${guide.source}\n\n---\nSource: ${pageUrl}\nFull documentation for AI assistants: ${new URL('llms-full.txt', window.location.href.split('#')[0]).href}\n`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={copyForAi}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-paynet border border-paynet-primary text-paynet-primary bg-white hover:bg-paynet-light transition-colors"
          title={ui.forAiHint}
        >
          {copied ? <Check className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          {copied ? ui.copied : ui.copyForAi}
        </button>
        <a
          href={`docs/${guide.slug}.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-paynet border border-paynet-gray-300 text-paynet-gray-600 bg-white hover:bg-paynet-gray-50 transition-colors"
        >
          <FileText className="w-4 h-4" />
          {ui.openMarkdown} (EN)
        </a>
      </div>

      <Markdown source={guide.source} onNavigate={onNavigate} />

      <nav className="flex justify-between gap-4 mt-12 pt-6 border-t border-paynet-gray-200">
        {previous ? (
          <button
            type="button"
            onClick={() => onNavigate(`#/guides/${previous.slug}`)}
            className="text-left group flex items-center gap-2 text-paynet-gray-600 hover:text-paynet-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>
              <span className="block text-xs text-paynet-gray-400">{ui.previous}</span>
              <span className="font-medium">{previous.title}</span>
            </span>
          </button>
        ) : <span />}
        {next ? (
          <button
            type="button"
            onClick={() => onNavigate(`#/guides/${next.slug}`)}
            className="text-right group flex items-center gap-2 text-paynet-gray-600 hover:text-paynet-primary"
          >
            <span>
              <span className="block text-xs text-paynet-gray-400">{ui.next}</span>
              <span className="font-medium">{next.title}</span>
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : <span />}
      </nav>
    </article>
  );
};
