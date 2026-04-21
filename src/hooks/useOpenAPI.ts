import { useState, useEffect, useMemo } from 'react';
import { OpenAPISpec, ServiceCategory } from '../types/api';
import { parseOpenAPI } from '../utils/openApiParser';
import { loadOpenAPISpecs, getDefaultSpec } from '../utils/openApiLoader';
import { Language } from '../types/language';

export const useOpenAPI = (language: Language = 'en') => {
  const [selectedSpec, setSelectedSpec] = useState<string>('default');
  const [availableSpecs, setAvailableSpecs] = useState<Record<string, OpenAPISpec>>({});

  useEffect(() => {
    // Load OpenAPI specs from files
    const specs = loadOpenAPISpecs();
    
    // Set available specs from loaded files
    if (Object.keys(specs).length > 0) {
      setAvailableSpecs(specs);
      // Set the first available spec as selected
      const firstSpec = Object.keys(specs)[0];
      setSelectedSpec(firstSpec);
    } else {
      // No specs found - this should not happen in production
      console.warn('No OpenAPI specifications found in /src/openapi/ directory');
      setAvailableSpecs({});
    }
  }, []);

  const currentSpec = useMemo(() => {
    return availableSpecs[selectedSpec] || null;
  }, [availableSpecs, selectedSpec]);

  const categories = useMemo(() => {
    return currentSpec ? parseOpenAPI(currentSpec, language) : [];
  }, [currentSpec, language]);

  const baseUrl = useMemo(() => {
    return currentSpec?.servers?.[0]?.url || 'https://ecom-api-test.paynet.md';
  }, [currentSpec]);

  return {
    currentSpec,
    categories,
    baseUrl,
    selectedSpec,
    setSelectedSpec,
    availableSpecs: Object.keys(availableSpecs),
    specInfo: currentSpec?.info || { title: 'No API Spec', version: '1.0.0', description: 'No specification loaded' }
  };
};