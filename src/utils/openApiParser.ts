import { OpenAPISpec, ServiceCategory, Endpoint } from '../types/api';
import { Language } from '../types/language';
import apiTagsData from '../data/api_tags.json';
import { getMethodTranslation } from './pathTranslations';

const PREFERRED_ENDPOINT_ORDER = [
  'POST /auth',
  'POST /api/order',
  'POST /api/order/refund',
  'GET /api/order/{id}',
  'GET /api/order/merchant/{id}',
  'POST /api/linked-cards/unlink',
  'GET /api/order/search',
  'GET /api/statement',
  'GET /api/statement/download',
];

function getEndpointOrderRank(endpoint: Endpoint): number {
  const key = `${endpoint.method} ${endpoint.path}`;
  const index = PREFERRED_ENDPOINT_ORDER.indexOf(key);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getTagTranslation(tagName: string, language: Language): string {
  const items = apiTagsData.items[0];
  const languageData = items[language];
  
  if (languageData) {
    const tag = languageData.find(tag => tag.name === tagName);
    if (tag) {
      return tag.description;
    }
  }
  
  // Fallback to English if translation not found
  const englishData = items.en;
  const englishTag = englishData.find(tag => tag.name === tagName);
  return englishTag?.description || `${tagName} related endpoints`;
}

export function parseOpenAPI(spec: OpenAPISpec, language: Language = 'en'): ServiceCategory[] {
  const categories: { [key: string]: ServiceCategory } = {};

  Object.entries(spec.paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      const tag = operation.tags?.[0] || 'General';
      
      if (!categories[tag]) {
        categories[tag] = {
          id: tag.toLowerCase().replace(/\s+/g, '-'),
          name: getTagTranslation(tag, language),
          description: getTagTranslation(tag, language),
          endpoints: []
        };
      }

      const endpoint: Endpoint = {
        id: `${method}-${path}`.replace(/[{}\/]/g, '-').replace(/-+/g, '-'),
        method: method.toUpperCase(),
        path,
        summary: getMethodTranslation(path, method.toUpperCase(), language, operation.summary).name,
        description: operation.description,
        parameters: operation.parameters?.map(param => ({
          name: param.name,
          in: param.in,
          description: param.description,
          required: param.required,
          type: param.schema.type
        })),
        responses: operation.responses
      };

      categories[tag].endpoints.push(endpoint);
    });
  });

  const sortedCategories = Object.values(categories)
    .map((category) => ({
      ...category,
      endpoints: [...category.endpoints].sort((a, b) => {
        const rankDiff = getEndpointOrderRank(a) - getEndpointOrderRank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.path.localeCompare(b.path);
      }),
    }))
    .sort((a, b) => {
      const aMinRank = a.endpoints.length > 0
        ? Math.min(...a.endpoints.map(getEndpointOrderRank))
        : Number.MAX_SAFE_INTEGER;
      const bMinRank = b.endpoints.length > 0
        ? Math.min(...b.endpoints.map(getEndpointOrderRank))
        : Number.MAX_SAFE_INTEGER;
      if (aMinRank !== bMinRank) return aMinRank - bMinRank;
      return a.name.localeCompare(b.name);
    });

  return sortedCategories;
}