import { useState, useEffect } from 'react';
import { Language } from '../types/language';
import { getTranslation } from '../locales';
import apiInfoData from '../data/api_info.json';

export const useLanguage = () => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('tps-api-language');
    return (saved as Language) || 'en';
  });

  const t = getTranslation(language);
  
  // Get API info from JSON file based on current language
  const getApiInfo = () => {
    const item = apiInfoData.items.find(item => item[language]);
    const languageData = item?.[language] || apiInfoData.items.find(item => item.en)?.en || {
      title: 'API Documentation Portal',
      description: 'API Documentation'
    };
    
    return {
      ...languageData,
      author: apiInfoData.author,
      version: apiInfoData.version
    };
  };

  const changeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    localStorage.setItem('tps-api-language', newLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return {
    language,
    changeLanguage,
    t,
    apiInfo: getApiInfo()
  };
};