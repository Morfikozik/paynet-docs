import { Language } from '../types/language';
import apiPathsData from '../data/api_paths.json';

interface PathInfo {
  language: string;
  name: string;
  description: string;
}

interface MethodInfo {
  method: string;
  info: PathInfo[];
  responses?: {
    [statusCode: string]: {
      description: string;
      content: {
        type: string;
        object: any;
      };
    };
  };
}

interface PathData {
  [path: string]: MethodInfo[];
}

export function getMethodTranslation(path: string, method: string, language: Language, fallbackSummary?: string): { name: string; description: string; responses?: any } {
  // Find the path in the JSON data
  const pathsArray = apiPathsData.paths as PathData[];
  
  for (const pathObj of pathsArray) {
    const pathKey = Object.keys(pathObj).find(key => key === path);
    if (pathKey && pathObj[pathKey]) {
      const methods = pathObj[pathKey];
      const methodData = methods.find(m => m.method.toLowerCase() === method.toLowerCase());
      
      if (methodData && methodData.info) {
        // Find translation for the current language
        const translation = methodData.info.find(info => info.language === language);
        if (translation) {
          return {
            name: translation.name,
            description: translation.description,
            responses: methodData.responses
          };
        }
        
        // Fallback to English if current language not found
        const englishTranslation = methodData.info.find(info => info.language === 'en');
        if (englishTranslation) {
          return {
            name: englishTranslation.name,
            description: englishTranslation.description,
            responses: methodData.responses
          };
        }
      }
    }
  }
  
  // Default fallback if no translation found
  const defaultName = fallbackSummary || `${method.toUpperCase()} ${path.split('/').pop() || path}`;
  const defaultDescription = fallbackSummary || `${method.toUpperCase()} method for ${path}`;
  
  return {
    name: defaultName,
    description: defaultDescription,
    responses: undefined
  };
}