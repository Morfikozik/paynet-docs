import React from 'react';
import { AlertCircle, CheckCircle, Copy, Check, FileText } from 'lucide-react';
import { Endpoint } from '../types/api';
import { TranslationResources, Language } from '../types/language';
import { AuthenticationBlock } from './AuthenticationBlock';
import { getMethodTranslation } from '../utils/pathTranslations';
import { translateOpenApiDescription } from '../utils/openApiDescriptionTranslations';

interface EndpointDetailsProps {
  endpoint: Endpoint;
  baseUrl: string;
  servers?: Array<{
    url: string;
    description: string;
  }>;
  t: TranslationResources;
  language: Language;
  spec?: any; // Add spec prop to access full OpenAPI specification
}

export const EndpointDetails: React.FC<EndpointDetailsProps> = ({ endpoint, baseUrl, servers = [], t, language, spec = {} }) => {
  const [activeServerTab, setActiveServerTab] = React.useState(() => {
    // Find sandbox server index, default to 0 if not found
    const sandboxIndex = servers.findIndex(server => 
      server.description?.toLowerCase().includes('sandbox') || 
      server.url?.toLowerCase().includes('test')
    );
    return sandboxIndex >= 0 ? sandboxIndex : 0;
  });
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);
  const [activeResponseCode, setActiveResponseCode] = React.useState<string>('');
  const [copiedRequestBody, setCopiedRequestBody] = React.useState<string | null>(null);

  // Function to format JSON with syntax highlighting
  const formatJsonWithSyntaxHighlighting = (jsonString: string): string => {
    return jsonString
      .replace(/(".*?")\s*:/g, '<span style="color: #60A5FA;">$1</span>:') // Keys - blue
      .replace(/:\s*(".*?")/g, ': <span style="color: #34D399;">$1</span>') // String values - green
      .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color: #F59E0B;">$1</span>') // Numbers - orange
      .replace(/:\s*(true|false)/g, ': <span style="color: #EF4444;">$1</span>') // Booleans - red
      .replace(/:\s*(null)/g, ': <span style="color: #9CA3AF;">$1</span>') // null - gray
      .replace(/([{}[\],])/g, '<span style="color: #D1D5DB;">$1</span>'); // Brackets and commas - light gray
  };

  // Handle copying request body
  const handleCopyRequestBody = async (content: string, contentType: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedRequestBody(contentType);
      setTimeout(() => setCopiedRequestBody(null), 2000);
    } catch (err) {
      console.error('Failed to copy request body:', err);
    }
  };

  // Get localized method name and description
  const methodTranslation = getMethodTranslation(endpoint.path, endpoint.method, language, endpoint.summary);

  // Use servers from props or fallback to baseUrl
  const availableServers = servers.length > 0 ? servers : [{ url: baseUrl, description: 'Default Server' }];
  const currentServer = availableServers[activeServerTab];

  // Determine which responses to use - from api_paths.json or OpenAPI
  const responsesToShow = methodTranslation.responses || endpoint.responses;
  const responseKeys = Object.keys(responsesToShow);
  // Get request body from OpenAPI spec
  const requestBody = spec?.paths?.[endpoint.path]?.[endpoint.method.toLowerCase()]?.requestBody;
  const normalizePropertyName = (name: string) => name.toLowerCase();
  const resolveSchemaRef = (schema: any): any => {
    if (!schema) return null;
    if (schema.$ref && typeof schema.$ref === 'string') {
      const refParts = schema.$ref.split('/');
      const schemaName = refParts[refParts.length - 1];
      return spec?.components?.schemas?.[schemaName] || null;
    }
    return schema;
  };
  const inferType = (value: unknown): string => {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  };
  const findBestMatchingComponentSchema = (example: Record<string, unknown>): any => {
    const schemas = spec?.components?.schemas;
    if (!schemas || typeof schemas !== 'object') return null;

    const exampleKeys = Object.keys(example).map(normalizePropertyName);
    if (exampleKeys.length === 0) return null;

    let bestSchema: any = null;
    let bestScore = 0;

    Object.values(schemas).forEach((candidate: any) => {
      if (!candidate || candidate.type !== 'object' || !candidate.properties) return;

      const candidatePropertyNames = Object.keys(candidate.properties).map(normalizePropertyName);
      const matchedKeys = exampleKeys.filter(key => candidatePropertyNames.includes(key));
      const score = matchedKeys.length / exampleKeys.length;

      if (score > bestScore) {
        bestScore = score;
        bestSchema = candidate;
      }
    });

    return bestScore >= 0.5 ? bestSchema : null;
  };
  const requestBodyDescriptionItems = React.useMemo(() => {
    if (!requestBody?.content) return [];

    const jsonContent = requestBody.content['application/json'];
    const fallbackContent = Object.values(requestBody.content)[0] as any;
    const selectedContent = jsonContent || fallbackContent;
    if (!selectedContent) return [];

    const example = selectedContent.example && typeof selectedContent.example === 'object'
      ? selectedContent.example as Record<string, unknown>
      : null;

    const directSchema = resolveSchemaRef(selectedContent.schema);
    const matchedSchema = directSchema || (example ? findBestMatchingComponentSchema(example) : null);

    type RequestBodyRow = {
      name: string;
      type: string;
      in: 'body';
      required: boolean;
      description: string;
    };

    const rows: RequestBodyRow[] = [];
    const seen = new Set<string>();

    const getRowType = (schemaNode: any, value: unknown): string => {
      if (schemaNode?.type) return schemaNode.type;
      if (schemaNode?.$ref) return 'object';
      return inferType(value);
    };

    const addRow = (row: RequestBodyRow) => {
      if (seen.has(row.name)) return;
      seen.add(row.name);
      rows.push(row);
    };

    const walk = (
      schemaNode: any,
      exampleNode: unknown,
      parentPath = '',
      required = false,
      preferredName?: string,
    ) => {
      const resolvedNode = resolveSchemaRef(schemaNode);
      const nodeType = getRowType(resolvedNode, exampleNode);

      if (parentPath) {
        addRow({
          name: parentPath,
          type: nodeType,
          in: 'body',
          required,
          description: translateOpenApiDescription(resolvedNode?.description, language) || t.common.description,
        });
      }

      if (nodeType === 'object') {
        const schemaProps = resolvedNode?.properties || {};
        const requiredSet = new Set(resolvedNode?.required || []);
        const exampleObj = exampleNode && typeof exampleNode === 'object' && !Array.isArray(exampleNode)
          ? (exampleNode as Record<string, unknown>)
          : {};

        const schemaKeys = Object.keys(schemaProps);
        const exampleKeys = Object.keys(exampleObj);
        const allKeys = Array.from(new Set([...schemaKeys, ...exampleKeys]));

        allKeys.forEach((schemaKey) => {
          const propSchema = schemaProps[schemaKey];
          const exampleKey = exampleKeys.find((k) => normalizePropertyName(k) === normalizePropertyName(schemaKey)) || schemaKey;
          const displayName = preferredName || exampleKey;
          const nextPath = parentPath ? `${parentPath}.${displayName}` : displayName;
          walk(propSchema, exampleObj[exampleKey], nextPath, requiredSet.has(schemaKey), exampleKey);
        });
        return;
      }

      if (nodeType === 'array') {
        const arraySchema = resolveSchemaRef(resolvedNode?.items);
        const firstItem = Array.isArray(exampleNode) && exampleNode.length > 0 ? exampleNode[0] : undefined;
        const itemPath = `${parentPath}[]`;
        walk(arraySchema, firstItem, itemPath, required);
      }
    };

    if (matchedSchema || example) {
      walk(matchedSchema, example, '', false);
    }

    return rows;
  }, [requestBody, spec, t.common.description, language]);
  
  // Set initial active response code - prefer 200, then first available
  React.useEffect(() => {
    if (responseKeys.length > 0) {
      // Prefer 200 status code, otherwise use first available
      const preferredCode = responseKeys.includes('200') ? '200' : responseKeys[0];
      setActiveResponseCode(preferredCode);
    }
  }, [responseKeys.join(',')]); // Use join to create stable dependency

  const handleCopyUrl = async (url: string) => {
    try {
      const fullUrl = `${url}${endpoint.path}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(fullUrl);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };


  // Function to render schema properties as table rows
  const renderSchemaProperties = (schema: any, parentKey = '') => {
    if (!schema || !schema.properties) return null;
    
    return Object.entries(schema.properties).map(([key, prop]: [string, any]) => {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      const isRequired = schema.required?.includes(key) || prop.required === true || false;
      
      return (
        <tr key={fullKey} className="hover:bg-paynet-gray-50 transition-colors duration-150">
          <td className="px-4 py-3 text-sm font-mono text-paynet-gray-900 font-semibold break-all">{fullKey}</td>
          <td className="px-4 py-3 text-sm text-paynet-gray-600">
            <span className="bg-paynet-gray-100 px-2 py-1 rounded-md text-xs font-mono font-semibold">
              {prop.type || 'object'}
            </span>
          </td>
          <td className="px-4 py-3 text-sm">
            {isRequired ? (
              <span className="flex items-center gap-1 text-paynet-error font-medium">
                <AlertCircle className="w-4 h-4" />
                {t.common.required}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-paynet-success">
                <CheckCircle className="w-4 h-4" />
                {t.common.optional}
              </span>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-paynet-gray-600 break-words">
            {translateOpenApiDescription(prop.description, language) || prop.example || t.common.description}
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="w-full max-w-none">
      {/* Название метода */}
      <div className="mb-4 sm:mb-8">
        <div className="flex items-center gap-3 mb-2 sm:mb-3">
          <span className={`text-xs font-mono px-2 py-1 rounded ${
            endpoint.method === 'GET' ? 'bg-green-100 text-green-700' :
            endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' :
            endpoint.method === 'PUT' ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            {endpoint.method}
          </span>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-paynet-primary">
            {methodTranslation.name}
          </h1>
        </div>
        
        {/* Подробное описание метода из api_paths.json */}
        <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full">
          <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary mb-3 sm:mb-4">
            {t.common.methodDescription}
          </h2>
          <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed">
            {methodTranslation.description}
          </p>
        </div>
      </div>

      {/* Тип запроса и пример URL */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full">
        <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary mb-3 sm:mb-4">
          {t.common.requestTypeAndUrl}
        </h2>
        <div className="space-y-4">
          {/* Server Tabs */}
          <div>
            <span className="text-sm font-medium text-paynet-gray-600 block mb-3">{t.common.name} URL:</span>
            
            {/* Tabs Navigation */}
            {availableServers.length > 1 && (
              <div className="flex flex-col sm:flex-row mb-3 bg-paynet-gray-100 rounded-lg p-1 gap-1 sm:gap-0">
                {availableServers.map((server, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveServerTab(index)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      activeServerTab === index
                        ? 'bg-white text-paynet-primary shadow-paynet font-semibold'
                        : 'text-paynet-gray-600 hover:text-paynet-gray-900'
                    }`}
                  >
                    {server.description}
                  </button>
                ))}
              </div>
            )}
            
            {/* URL Display with Copy Button */}
            <div className="relative">
              <code className="text-base font-mono text-paynet-gray-900 bg-paynet-gray-50 px-4 py-3 pr-12 rounded-lg block break-all border border-paynet-gray-200">
                {currentServer.url}{endpoint.path}
              </code>
              <button
                onClick={() => handleCopyUrl(currentServer.url)}
                className="absolute top-3 right-3 p-2 bg-paynet-gray-200 hover:bg-paynet-gray-300 rounded-md transition-all duration-200 hover:scale-105"
                title={t.common.copyToClipboard}
              >
                {copiedUrl === `${currentServer.url}${endpoint.path}` ? (
                  <Check className="w-4 h-4 text-paynet-success" />
                ) : (
                  <Copy className="w-4 h-4 text-paynet-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Описание метода из OpenAPI (если есть) */}
      {endpoint.description && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full">
          <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary mb-3 sm:mb-4 flex items-center gap-2">
            <span>OpenAPI {t.common.methodDescription}</span>
          </h2>
          <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed">{endpoint.description}</p>
        </div>
      )}

      {/* Блок авторизации */}
      {endpoint.path !== '/auth' && (
        <AuthenticationBlock t={t} language={language} />
      )}

      {/* Parameters */}
      {((endpoint.parameters && endpoint.parameters.length > 0) || requestBodyDescriptionItems.length > 0) && (
        <div className="space-y-4 mb-8">
          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full">
              <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary mb-3 sm:mb-4">
                {t.common.parameters}
              </h2>
              <div className="overflow-x-auto rounded-lg border border-paynet-gray-200 w-full">
                <table className="w-full">
                  <thead className="bg-paynet-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.name}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.type}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.in}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.required}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.description}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paynet-gray-200">
                    {endpoint.parameters.map((param, index) => (
                      <tr key={index} className="hover:bg-paynet-gray-50 transition-colors duration-150">
                        <td className="px-4 py-3 text-sm font-mono text-paynet-gray-900 font-semibold break-all">{param.name}</td>
                        <td className="px-4 py-3 text-sm text-paynet-gray-600">
                          <span className="bg-paynet-gray-100 px-2 py-1 rounded-md text-xs font-mono font-semibold">
                            {param.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            param.in === 'path' ? 'bg-purple-100 text-purple-800' :
                            param.in === 'query' ? 'bg-blue-100 text-blue-800' :
                            'bg-paynet-gray-100 text-paynet-gray-800'
                          }`}>
                            {param.in}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {param.required ? (
                            <span className="flex items-center gap-1 text-paynet-error font-medium">
                              <AlertCircle className="w-4 h-4" />
                              {t.common.required}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-paynet-success">
                              <CheckCircle className="w-4 h-4" />
                              {t.common.optional}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-paynet-gray-600 break-words">
                          {translateOpenApiDescription(param.description, language) || t.common.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {requestBodyDescriptionItems.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full">
              <h3 className="text-lg sm:text-xl font-semibold text-paynet-primary mb-3 sm:mb-4">
                {t.common.parameters} - {t.common.description}
              </h3>
              <div className="overflow-x-auto rounded-lg border border-paynet-gray-200 w-full">
                <table className="w-full">
                  <thead className="bg-paynet-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.name}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.type}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.in}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.required}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.description}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paynet-gray-200">
                    {requestBodyDescriptionItems.map((param, index) => (
                      <tr key={`${param.name}-${index}`} className="hover:bg-paynet-gray-50 transition-colors duration-150">
                        <td className="px-4 py-3 text-sm font-mono text-paynet-gray-900 font-semibold break-all">{param.name}</td>
                        <td className="px-4 py-3 text-sm text-paynet-gray-600">
                          <span className="bg-paynet-gray-100 px-2 py-1 rounded-md text-xs font-mono font-semibold">
                            {param.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {param.in}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {param.required ? (
                            <span className="flex items-center gap-1 text-paynet-error font-medium">
                              <AlertCircle className="w-4 h-4" />
                              {t.common.required}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-paynet-success">
                              <CheckCircle className="w-4 h-4" />
                              {t.common.optional}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-paynet-gray-600 break-words">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Request Body */}
      {requestBody && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full">
          <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary mb-3 sm:mb-4">
            Request Body
          </h2>
          
          {/* Content Type */}
          {requestBody.content && (
            <div className="mb-4">
              <span className="text-sm font-medium text-paynet-gray-600 block mb-2">Content-Type:</span>
              <div className="flex flex-wrap gap-2">
                {Object.keys(requestBody.content).map((contentType) => (
                  <span key={contentType} className="bg-paynet-gray-100 px-3 py-1 rounded-md text-sm font-mono font-semibold text-paynet-gray-800">
                    {contentType}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Schema Properties Table */}
          {requestBody.content && Object.entries(requestBody.content).map(([contentType, content]: [string, any]) => {
            // Show example if available
            if (content.example && contentType === 'application/json') {
              const exampleJson = JSON.stringify(content.example, null, 2);
              return (
                <div key={contentType} className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-paynet-gray-600 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Request Body Example:
                    </span>
                    <button
                      onClick={() => handleCopyRequestBody(exampleJson, contentType)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-paynet-primary hover:bg-paynet-secondary text-white text-xs font-medium rounded-paynet transition-all duration-200 hover:scale-105 shadow-paynet"
                      title={t.common.copyToClipboard}
                    >
                      {copiedRequestBody === contentType ? (
                        <>
                          <Check className="w-3 h-3" />
                          {t.common.copied}
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          {t.common.copyToClipboard}
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto border border-gray-700 w-full font-mono relative">
                      <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        JSON
                      </div>
                      <pre className="text-gray-100">
                        <code dangerouslySetInnerHTML={{ 
                          __html: formatJsonWithSyntaxHighlighting(JSON.stringify(content.example, null, 2))
                        }} />
                      </pre>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Show schema properties table if no example but has schema
            if (content.schema && content.schema.properties) {
              return (
                <div key={contentType} className="mb-4">
                  <span className="text-sm font-medium text-paynet-gray-600 block mb-3">Schema Properties:</span>
                  <div className="overflow-x-auto rounded-lg border border-paynet-gray-200 w-full">
                    <table className="w-full">
                      <thead className="bg-paynet-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.name}</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.type}</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.required}</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{t.common.description}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-paynet-gray-200">
                        {renderSchemaProperties(content.schema)}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }
            
            return null;
          })}
        </div>
      )}
      {/* Responses */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full">
        <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary mb-3 sm:mb-4">{t.common.responses}</h2>
        
        {/* Response Code Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {responseKeys.map((statusCode) => (
            <button
              key={statusCode}
              onClick={() => setActiveResponseCode(statusCode)}
              className={`px-4 py-2 text-sm font-mono rounded-lg transition-all duration-200 font-semibold ${
                activeResponseCode === statusCode
                  ? statusCode.startsWith('2') 
                    ? 'bg-paynet-success text-white shadow-paynet-lg' 
                    : statusCode.startsWith('4') 
                    ? 'bg-paynet-error text-white shadow-paynet-lg'
                    : statusCode.startsWith('5')
                    ? 'bg-red-600 text-white shadow-paynet-lg'
                    : 'bg-paynet-primary text-white shadow-paynet-lg'
                  : statusCode.startsWith('2') 
                    ? 'bg-green-50 text-paynet-success hover:bg-green-100 border border-green-200' 
                    : statusCode.startsWith('4') 
                    ? 'bg-red-50 text-paynet-error hover:bg-red-100 border border-red-200'
                    : statusCode.startsWith('5')
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    : 'bg-paynet-light text-paynet-primary hover:bg-blue-100 border border-paynet-gray-200'
              }`}
            >
              {statusCode}
            </button>
          ))}
        </div>

        {/* Active Response Details */}
        {activeResponseCode && responsesToShow[activeResponseCode] && (
          <div className="border border-paynet-gray-200 rounded-lg p-4 bg-paynet-gray-50 w-full">
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 text-sm font-mono rounded-full font-semibold ${
                  activeResponseCode.startsWith('2') ? 'bg-green-100 text-paynet-success' :
                  activeResponseCode.startsWith('4') ? 'bg-red-100 text-paynet-error' :
                  activeResponseCode.startsWith('5') ? 'bg-red-100 text-red-700' :
                  'bg-paynet-gray-100 text-paynet-gray-800'
                }`}>
                  {activeResponseCode}
                </span>
                <span className="text-sm font-medium text-paynet-gray-900">
                  {methodTranslation.responses 
                    ? responsesToShow[activeResponseCode].description 
                    : responsesToShow[activeResponseCode].description
                  }
                </span>
              </div>
              
              {/* Content Type and Response Body */}
              {methodTranslation.responses && responsesToShow[activeResponseCode].content ? (
                // From api_paths.json
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-paynet-gray-600">Content-Type:</span>
                    <span className="text-xs font-mono bg-paynet-gray-100 px-2 py-1 rounded-md text-paynet-gray-800 font-semibold">
                      {responsesToShow[activeResponseCode].content.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-paynet-gray-600 block mb-2">Response Body:</span>
                    <pre className="bg-white p-4 rounded-lg text-sm overflow-x-auto border border-paynet-gray-200 w-full font-mono">
                      <code>{JSON.stringify(responsesToShow[activeResponseCode].content.object, null, 2)}</code>
                    </pre>
                  </div>
                </div>
              ) : responsesToShow[activeResponseCode].content ? (
                // From OpenAPI
                <div>
                  <span className="text-xs font-medium text-paynet-gray-600 block mb-2">Schema:</span>
                  <pre className="bg-white p-4 rounded-lg text-sm overflow-x-auto border border-paynet-gray-200 w-full font-mono">
                    <code>{JSON.stringify(responsesToShow[activeResponseCode].content['application/json']?.schema, null, 2)}</code>
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};