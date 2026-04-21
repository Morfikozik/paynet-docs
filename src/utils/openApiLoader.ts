import yaml from 'js-yaml';
import { OpenAPISpec } from '../types/api';

// This will be populated at build time with actual OpenAPI files
const openApiFiles: Record<string, string> = {};

// Import all OpenAPI files from the openapi directory
// This uses Vite's glob import feature
const modules = import.meta.glob('../openapi/**/*.{json,yaml,yml}', { 
  query: '?raw',
  import: 'default',
  eager: true 
});

// Process the imported files
Object.entries(modules).forEach(([path, content]) => {
  const fileName = path.split('/').pop()?.replace(/\.(json|yaml|yml)$/, '') || 'default';
  openApiFiles[fileName] = content as string;
});

export function loadOpenAPISpecs(): Record<string, OpenAPISpec> {
  const specs: Record<string, OpenAPISpec> = {};
  
  Object.entries(openApiFiles).forEach(([fileName, content]) => {
    try {
      let parsedSpec: OpenAPISpec;
      
      // Try to parse as JSON first, then as YAML
      try {
        parsedSpec = JSON.parse(content);
      } catch {
        parsedSpec = yaml.load(content) as OpenAPISpec;
      }
      
      // Validate that it's a valid OpenAPI spec
      if (parsedSpec && parsedSpec.openapi && parsedSpec.info && parsedSpec.paths) {
        specs[fileName] = parsedSpec;
      } else {
        console.warn(`Invalid OpenAPI specification in file: ${fileName}`);
      }
    } catch (error) {
      console.error(`Error parsing OpenAPI file ${fileName}:`, error);
    }
  });
  
  return specs;
}

export function getAvailableSpecs(): string[] {
  return Object.keys(openApiFiles);
}

export function getDefaultSpec(): OpenAPISpec | null {
  const specs = loadOpenAPISpecs();
  const specNames = Object.keys(specs);
  
  if (specNames.length === 0) {
    return null;
  }
  
  // Return the first available spec, or prefer 'tps' if it exists
  const defaultName = specNames.includes('tps') ? 'tps' : specNames[0];
  return specs[defaultName];
}