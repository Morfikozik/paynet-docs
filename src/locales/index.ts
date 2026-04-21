import { Language, TranslationResources } from '../types/language';
import { en } from './en';
import { ro } from './ro';
import { ru } from './ru';

export const translations: Record<Language, TranslationResources> = {
  en,
  ro,
  ru
};

export const getTranslation = (language: Language): TranslationResources => {
  return translations[language] || translations.en;
};