import React from 'react';
import { Bot, Menu, X } from 'lucide-react';
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
  onHome?: () => void;
  onMenu?: () => void;
  menuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ language, onLanguageChange, apiInfo, onHome, onMenu, menuOpen }) => {
  return (
    <header className="bg-white border-b border-paynet-gray-200 px-3 py-2.5 sm:px-6 sm:py-4 shadow-paynet-lg relative z-50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center sm:items-end gap-2 sm:gap-3 min-w-0">
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="md:hidden -ml-1 p-2 rounded-paynet text-paynet-gray-700 hover:bg-paynet-light"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}
          <a 
            href="https://merchant.paynet.md" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200"
          >
            <img 
              src="logos/paynet_business.svg" 
              alt="PayNet Logo" 
              className="h-6 sm:h-8 w-auto"
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
          <button
            type="button"
            onClick={onHome}
            className="sm:ml-3 flex flex-col justify-end leading-none sm:-translate-y-1.5 text-left hover:opacity-80"
          >
            <span className="text-xs bg-paynet-orange text-white px-2 py-0.5 rounded-full font-medium w-fit mb-0.5">API</span>
            <span className="hidden sm:inline text-sm text-paynet-gray-500 font-normal leading-none">
              {apiInfo?.title || 'API Documentation Portal'}
            </span>
          </button>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <a
            href="llms-full.txt"
            target="_blank"
            rel="noopener noreferrer"
            title={guideUiText[language].forAiHint}
            className="hidden lg:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-paynet border border-paynet-primary text-paynet-primary hover:bg-paynet-light transition-colors"
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