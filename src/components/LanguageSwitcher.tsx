import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { Language } from '../types/language';

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
}

const languages = [
  { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
  { code: 'ro' as Language, name: 'Română', flag: '🇷🇴' },
  { code: 'ru' as Language, name: 'Русский', flag: '🇷🇺' }
];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  currentLanguage,
  onLanguageChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-sm font-medium text-paynet-gray-700 bg-white border border-paynet-gray-300 rounded-paynet hover:bg-paynet-gray-50 focus:outline-none focus:ring-2 focus:ring-paynet-primary focus:border-transparent transition-colors shadow-paynet"
      >
        <Globe className="hidden sm:block w-4 h-4" />
        <span className="text-lg">{currentLang.flag}</span>
        <span className="hidden sm:inline">{currentLang.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-paynet-gray-200 rounded-paynet shadow-paynet-lg z-50">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => {
                onLanguageChange(language.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-paynet-gray-50 transition-colors ${
                currentLanguage === language.code
                  ? 'bg-paynet-light text-paynet-primary font-medium border-l-4 border-paynet-primary'
                  : 'text-paynet-gray-700'
              } ${language === languages[0] ? 'rounded-t-paynet' : ''} ${
                language === languages[languages.length - 1] ? 'rounded-b-paynet' : ''
              }`}
            >
              <span className="text-lg">{language.flag}</span>
              <span>{language.name}</span>
              {currentLanguage === language.code && (
                <span className="ml-auto text-paynet-primary">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};