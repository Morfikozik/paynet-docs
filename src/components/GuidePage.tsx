import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AiMenu } from './AiMenu';
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
  const guides = getGuides(language).filter((item) => item.section === guide.section);
  const index = guides.findIndex((item) => item.slug === guide.slug);
  const previous = index > 0 ? guides[index - 1] : null;
  const next = index >= 0 && index < guides.length - 1 ? guides[index + 1] : null;

  return (
    <article className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <AiMenu
          language={language}
          title={guide.title}
          markdownPath={language === 'en' ? `docs/${guide.slug}.md` : `docs/${language}/${guide.slug}.md`}
          markdownLanguage={language.toUpperCase()}
          markdown={guide.source}
          onNavigate={onNavigate}
        />
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
