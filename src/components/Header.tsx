import React from 'react';
import { Bot } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { guideUiText } from '../content/guides';
import { Language } from '../types/language';

interface HeaderProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  apiInfo?: {
    title: string;
    description: string;
  };
}

export const Header: React.FC<HeaderProps> = ({ language, onLanguageChange, apiInfo }) => {
  return (
    <header className="bg-white border-b border-paynet-gray-200 px-6 py-4 shadow-paynet-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-end gap-3">
          <a 
            href="https://merchant.paynet.md" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200"
          >
            <img 
              src="logos/paynet_business.svg" 
              alt="PayNet Logo" 
              className="h-8 w-auto"
              onError={(e) => {
                // Fallback if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden w-12 h-12 bg-gradient-to-br from-paynet-primary to-paynet-secondary rounded-lg flex items-center justify-center shadow-paynet-lg">
              <span className="text-white font-bold text-lg">PN</span>
            </div>
          </a>
          <div className="ml-3 flex flex-col justify-end leading-none -translate-y-1.5">
            <span className="text-xs bg-paynet-orange text-white px-2 py-0.5 rounded-full font-medium w-fit mb-0.5">API</span>
            <p className="text-sm text-paynet-gray-500 font-normal leading-none">
              {apiInfo?.title || 'API Documentation Portal'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <a
            href="llms-full.txt"
            target="_blank"
            rel="noopener noreferrer"
            title={guideUiText[language].forAiHint}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-paynet border border-paynet-primary text-paynet-primary hover:bg-paynet-light transition-colors"
          >
            <Bot className="w-4 h-4" />
            {guideUiText[language].forAi}
          </a>
          <LanguageSwitcher
            currentLanguage={language}
            onLanguageChange={onLanguageChange}
          />
        </div>
      </div>
    </header>
  );
};