import React from 'react';
import { Book, Shield, Zap, Globe, Code, Users } from 'lucide-react';
import { TranslationResources, Language } from '../types/language';
import projectInfoEnHtml from '../data/projectInfo-en.html?raw';
import projectInfoRoHtml from '../data/projectInfo-ro.html?raw';
import projectInfoRuHtml from '../data/projectInfo-ru.html?raw';

interface ProjectInfoProps {
  t: TranslationResources;
  language: Language;
}

export const ProjectInfo: React.FC<ProjectInfoProps> = ({ t, language }) => {
  // Get the appropriate HTML content based on selected language
  const getHtmlContent = () => {
    switch (language) {
      case 'ro':
        return projectInfoRoHtml;
      case 'ru':
        return projectInfoRuHtml;
      default:
        return projectInfoEnHtml;
    }
  };

  // Parse HTML content and render it safely
  const createMarkup = () => {
    return { __html: getHtmlContent() };
  };

  return (
    <div className="w-full max-w-none">
      <div className="mb-4 sm:mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Book className="w-6 sm:w-8 h-6 sm:h-8 text-blue-600" />
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{t.common.projectInfo}</h1>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full hover:shadow-paynet-xl transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-5 sm:w-6 h-5 sm:h-6 text-paynet-success" />
            <h3 className="text-base sm:text-lg font-semibold text-paynet-primary">{t.common.secure}</h3>
          </div>
          <p className="text-paynet-gray-600 text-xs sm:text-sm">
            {t.common.secureDesc}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full hover:shadow-paynet-xl transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-5 sm:w-6 h-5 sm:h-6 text-paynet-orange" />
            <h3 className="text-base sm:text-lg font-semibold text-paynet-primary">{t.common.fast}</h3>
          </div>
          <p className="text-paynet-gray-600 text-xs sm:text-sm">
            {t.common.fastDesc}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full sm:col-span-2 lg:col-span-1 hover:shadow-paynet-xl transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-5 sm:w-6 h-5 sm:h-6 text-paynet-primary" />
            <h3 className="text-base sm:text-lg font-semibold text-paynet-primary">{t.common.global}</h3>
          </div>
          <p className="text-paynet-gray-600 text-xs sm:text-sm">
            {t.common.globalDesc}
          </p>
        </div>
      </div>

      {/* HTML Content */}
      <div className="bg-white rounded-lg shadow-paynet-lg border border-paynet-gray-200 overflow-hidden w-full">
        <div 
          className="prose prose-sm sm:prose-base lg:prose-lg max-w-none p-6 lg:p-8 project-info-content w-full"
          dangerouslySetInnerHTML={createMarkup()}
        />
      </div>

      {/* Quick links */}
      <div className="mt-8 bg-gradient-to-r from-paynet-light to-paynet-orange-light rounded-lg p-6 border border-paynet-gray-200 w-full">
        <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-3 sm:mb-4 flex items-center gap-2">
          <Code className="w-4 sm:w-5 h-4 sm:h-5 text-paynet-primary" />
          {t.common.quickLinks}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <a 
            href="https://paynet.md/home/contacts" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-paynet-primary hover:text-paynet-secondary transition-all duration-200 font-medium text-sm sm:text-base hover:translate-x-1"
          >
            <Users className="w-3 sm:w-4 h-3 sm:h-4" />
            {t.common.contactSupport}
          </a>
          <a 
            href="https://paynet.md/ro/home/terms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-paynet-primary hover:text-paynet-secondary transition-all duration-200 font-medium text-sm sm:text-base hover:translate-x-1"
          >
            <Shield className="w-3 sm:w-4 h-3 sm:h-4" />
            {t.common.termsOfService}
          </a>
        </div>
      </div>
    </div>
  );
};