import React from 'react';
import { Lock, Key, ChevronDown, ChevronRight } from 'lucide-react';
import { TranslationResources, Language } from '../types/language';
import authEnHtml from '../data/auth-en.html?raw';
import authRoHtml from '../data/auth-ro.html?raw';
import authRuHtml from '../data/auth-ru.html?raw';

interface AuthenticationBlockProps {
  t: TranslationResources;
  language: Language;
}

export const AuthenticationBlock: React.FC<AuthenticationBlockProps> = ({ t, language }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Get the appropriate HTML content based on selected language
  const getHtmlContent = () => {
    switch (language) {
      case 'ro':
        return authRoHtml;
      case 'ru':
        return authRuHtml;
      default:
        return authEnHtml;
    }
  };

  // Parse HTML content and render it safely
  const createMarkup = () => {
    return { __html: getHtmlContent() };
  };

  return (
    <div className="mb-10 bg-gradient-to-r from-paynet-light to-paynet-gray-50 rounded-paynet border border-paynet-gray-200 overflow-hidden w-full max-w-none">

      {/* Header with toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-paynet-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-paynet-primary" />
          <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary">
            {t.common.authentication}
          </h2>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-paynet-primary transition-transform" />
        ) : (
          <ChevronRight className="w-5 h-5 text-paynet-primary transition-transform" />
        )}
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <>
          {/* HTML Content */}
          <div 
            className="auth-content p-4 sm:p-6 pt-0 w-full"
            dangerouslySetInnerHTML={createMarkup()}
          />
          
          {/* Visual elements with icons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6 pt-0 w-full">
            <div className="bg-white p-3 sm:p-4 rounded-paynet border border-paynet-gray-200 w-full">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-paynet-primary" />
                <span className="font-mono text-xs sm:text-sm font-semibold text-paynet-primary break-all">username</span>
              </div>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-paynet border border-paynet-gray-200 w-full">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-paynet-primary" />
                <span className="font-mono text-xs sm:text-sm font-semibold text-paynet-primary break-all">password</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};