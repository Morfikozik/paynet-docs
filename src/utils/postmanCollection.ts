import { OpenAPISpec } from '../types/api';

type PostmanHeader = { key: string; value: string; type: 'text' };
type PostmanQuery = { key: string; value: string; description?: string; disabled?: boolean };
type PostmanVariable = { key: string; value: string; description?: string };
type PostmanRequest = {
  method: string;
  header: PostmanHeader[];
  url: string;
  description?: string;
  body?: {
    mode: 'raw';
    raw: string;
    options: { raw: { language: 'json' } };
  };
};
type PostmanItem = {
  name: string;
  request: PostmanRequest;
};

type PostmanCollection = {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  variable: Array<{ key: string; value: string }>;
  item: Array<{ name: string; item: PostmanItem[] }>;
};

const getOperation = (pathItem: Record<string, any>, method: string) => pathItem[method] ?? null;

const toPostmanPath = (openApiPath: string) => openApiPath.replace(/\{([^}]+)\}/g, ':$1');

const getOperationExample = (operation: any) => {
  const content = operation?.requestBody?.content;
  if (!content) return null;
  const json = content['application/json'];
  if (!json) return null;
  if (json.example !== undefined) return json.example;
  return null;
};

const getOperationQueryParams = (operation: any): PostmanQuery[] => {
  const params = Array.isArray(operation?.parameters) ? operation.parameters : [];
  return params
    .filter((param) => param?.in === 'query' && param?.name)
    .map((param) => ({
      key: String(param.name),
      value: '',
      description: param.description || undefined,
      disabled: !Boolean(param.required),
    }));
};

const buildRequestUrl = (path: string, query: PostmanQuery[]) => {
  const postmanPath = toPostmanPath(path);
  if (query.length === 0) return `{{baseUrl}}${postmanPath}`;
  const queryString = query.map((param) => `${encodeURIComponent(param.key)}=`).join('&');
  return `{{baseUrl}}${postmanPath}?${queryString}`;
};

export const buildPostmanCollectionFromOpenApi = (spec: OpenAPISpec): PostmanCollection => {
  const groupedItems = new Map<string, PostmanItem[]>();
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  const baseUrl = spec.servers?.[0]?.url || 'https://ecom-api-test.paynet.md';

  Object.entries(spec.paths || {}).forEach(([path, pathItem]) => {
    methods.forEach((method) => {
      const operation = getOperation(pathItem as Record<string, any>, method);
      if (!operation) return;

      const tag = operation.tags?.[0] || 'General';
      const operationName = operation.summary || `${method.toUpperCase()} ${path}`;
      const queryParams = getOperationQueryParams(operation);

      const request: PostmanRequest = {
        method: method.toUpperCase(),
        header: [
          { key: 'TPS_API_KEY', value: '{{tpsApiKey}}', type: 'text' },
          { key: 'X-API-KEY', value: '{{xApiKey}}', type: 'text' },
        ],
        url: buildRequestUrl(path, queryParams),
        description: operation.description || operation.summary || undefined,
      };

      const examplePayload = getOperationExample(operation);
      if (examplePayload !== null) {
        request.header.push({ key: 'Content-Type', value: 'application/json', type: 'text' });
        request.body = {
          mode: 'raw',
          raw: JSON.stringify(examplePayload, null, 2),
          options: { raw: { language: 'json' } },
        };
      }

      const item: PostmanItem = {
        name: operationName,
        request,
      };

      if (!groupedItems.has(tag)) groupedItems.set(tag, []);
      groupedItems.get(tag)?.push(item);
    });
  });

  return {
    info: {
      name: `${spec.info?.title || 'Ecommerce API'} - Postman Collection`,
      description: spec.info?.description || 'Generated from OpenAPI specification.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: baseUrl },
      { key: 'tpsApiKey', value: 'your_api_key_here' },
      { key: 'xApiKey', value: 'your_password_here' },
    ],
    item: Array.from(groupedItems.entries()).map(([name, item]) => ({ name, item })),
  };
};
