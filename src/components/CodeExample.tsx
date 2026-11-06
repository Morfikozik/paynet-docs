import React, { useState } from 'react';
import { Copy, Check, Play, Settings, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Endpoint } from '../types/api';
import { TranslationResources } from '../types/language';
import { generateCodeSnippets } from '../utils/codeGenerator';
import { OpenAPISpec } from '../types/api';
import { freshenRequestExample } from '../utils/sampleData';
import { buildTestRequest, executeApiTest, formatApiResponse, ApiTestResponse, getAuthToken, clearAuthToken } from '../utils/apiTester';

interface CodeExampleProps {
  endpoint: Endpoint;
  baseUrl: string;
  spec?: OpenAPISpec;
  t: TranslationResources;
}

export const CodeExample: React.FC<CodeExampleProps> = ({ endpoint, baseUrl, spec, t }) => {
  const [activeLanguage, setActiveLanguage] = useState('curl');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeSnippets, setCodeSnippets] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [parameterValues, setParameterValues] = useState<Record<string, Record<string, string>>>({});
  const [requestBodyValue, setRequestBodyValue] = useState<Record<string, string>>({});
  const [showParameterInput, setShowParameterInput] = useState(true);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testResponses, setTestResponses] = useState<Record<string, ApiTestResponse>>({});
  const [showTestResponse, setShowTestResponse] = useState<Record<string, boolean>>({});
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  // Check for existing token on component mount
  React.useEffect(() => {
    const token = getAuthToken();
    setCurrentToken(token);
  }, []);

  const availableLanguages = Object.keys(codeSnippets);

  // Get request body from OpenAPI spec
  const requestBody = spec?.paths?.[endpoint.path]?.[endpoint.method.toLowerCase()]?.requestBody;
  
  // Check for path parameters in URL (like {invoice_id})
  const pathParametersFromUrl = endpoint.path.match(/\{([^}]+)\}/g)?.map(match => ({
    name: match.slice(1, -1), // Remove { and }
    in: 'path',
    required: true,
    description: `Path parameter: ${match.slice(1, -1)}`,
    type: 'string'
  })) || [];
  
  // Combine regular parameters with path parameters from URL
  const allParameters = [
    ...(endpoint.parameters || []),
    ...pathParametersFromUrl.filter(pathParam => 
      !endpoint.parameters?.some(param => param.name === pathParam.name)
    )
  ];
  
  const hasParameters = allParameters.length > 0;
  
  // Check if we have form-urlencoded content type
  const hasFormUrlencodedBody = requestBody?.content && 
    Object.keys(requestBody.content).some(contentType => 
      contentType === 'application/x-www-form-urlencoded'
    );
  
  const hasJsonRequestBody = requestBody?.content && 
    Object.keys(requestBody.content).some(contentType => 
      contentType === 'application/json'
    );
  
  const hasRequestBody = hasJsonRequestBody; // Only show textarea for JSON

  // Get current endpoint values
  const currentParameterValues = parameterValues[endpoint.id] || {};
  const currentRequestBodyValue = requestBodyValue[endpoint.id] || '';
  const currentTestResponse = testResponses[endpoint.id] || null;
  const currentShowTestResponse = showTestResponse[endpoint.id] || false;

  // Initialize parameter values
  React.useEffect(() => {
    if (allParameters.length > 0 || hasFormUrlencodedBody) {
      const initialValues: Record<string, string> = {};
      
      // Add regular parameters
      allParameters.forEach(param => {
        initialValues[param.name] = '';
      });
      
      // Add form-urlencoded body parameters
      if (hasFormUrlencodedBody) {
        const content = requestBody.content['application/x-www-form-urlencoded'];
        if (content.schema && content.schema.properties) {
          Object.keys(content.schema.properties).forEach(propName => {
            initialValues[propName] = '';
          });
        }
      }
      
      setParameterValues(prev => ({
        ...prev,
        [endpoint.id]: initialValues
      }));
    }
  }, [endpoint.id, allParameters.length, hasFormUrlencodedBody]);

  // Initialize request body value
  React.useEffect(() => {
    if (hasJsonRequestBody) {
      const content = requestBody.content;
      const jsonContent = content['application/json'];
      const example = jsonContent?.example;
      if (example) {
        setRequestBodyValue(prev => ({
          ...prev,
          [endpoint.id]: JSON.stringify(freshenRequestExample(example), null, 2)
        }));
      } else {
        setRequestBodyValue(prev => ({
          ...prev,
          [endpoint.id]: '{}'
        }));
      }
    }
  }, [endpoint.id, hasJsonRequestBody, requestBody]);

  // Generate code snippets when component mounts or endpoint changes
  React.useEffect(() => {
    const generateCode = async () => {
      setIsLoading(true);
      try {
        if (spec) {
          const snippets = await generateCodeSnippets({ endpoint, baseUrl, spec });
          setCodeSnippets(snippets);
        }
      } catch (error) {
        console.error('Failed to generate code snippets:', error);
        // Fallback to empty snippets
        setCodeSnippets({});
      } finally {
        setIsLoading(false);
      }
    };

    generateCode();
  }, [endpoint.id, baseUrl, spec]);

  // Set initial active language if not set or not available
  React.useEffect(() => {
    if (availableLanguages.length > 0 && !availableLanguages.includes(activeLanguage)) {
      setActiveLanguage(availableLanguages[0]);
    }
  }, [availableLanguages.join(','), activeLanguage]);

  const handleCopy = async (code: string, language: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(language);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleParameterChange = (paramName: string, value: string) => {
    setParameterValues(prev => ({
      ...prev,
      [endpoint.id]: {
        ...prev[endpoint.id],
        [paramName]: value
      }
    }));
  };

  const handleRequestBodyChange = (value: string) => {
    setRequestBodyValue(prev => ({
      ...prev,
      [endpoint.id]: value
    }));
  };

  const regenerateCodeWithCustomValues = async () => {
    setIsLoading(true);
    try {
      if (spec) {
        // Create modified endpoint with custom values
        const modifiedEndpoint = {
          ...endpoint,
          customParameterValues: currentParameterValues,
          customRequestBody: currentRequestBodyValue
        };
        const snippets = await generateCodeSnippets({ 
          endpoint: modifiedEndpoint, 
          baseUrl, 
          spec 
        });
        setCodeSnippets(snippets);
      }
    } catch (error) {
      console.error('Failed to regenerate code snippets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestApi = async () => {
    if (!spec) return;
    
    setIsTestingApi(true);
    setTestResponses(prev => ({
      ...prev,
      [endpoint.id]: null as any
    }));
    
    try {
      const testRequest = buildTestRequest(endpoint, spec, currentParameterValues, currentRequestBodyValue);
      const response = await executeApiTest(testRequest);
      setTestResponses(prev => ({
        ...prev,
        [endpoint.id]: response
      }));
      setShowTestResponse(prev => ({
        ...prev,
        [endpoint.id]: true
      }));
      
      // Update token state if this was an auth request
      if (endpoint.path === '/auth' && response.status === 200) {
        const token = getAuthToken();
        setCurrentToken(token);
      }
    } catch (error) {
      console.error('API test failed:', error);
      setTestResponses(prev => ({
        ...prev,
        [endpoint.id]: {
          status: 0,
          statusText: 'Test Failed',
          headers: {},
          data: null,
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      }));
      setShowTestResponse(prev => ({
        ...prev,
        [endpoint.id]: true
      }));
    } finally {
      setIsTestingApi(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-paynet-gray-600">{t.common.generatingCodeExamples}</div>
      </div>
    );
  }
  
  if (availableLanguages.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-paynet-gray-600">{t.common.noCodeExamplesAvailable}</div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.common.codeExamples}</h3>
      
      {/* Token Status Display */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${currentToken ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              Auth Token: {currentToken ? 'Active' : 'Not Set'}
            </span>
          </div>
          {currentToken && (
            <button
              onClick={() => {
                clearAuthToken();
                setCurrentToken(null);
              }}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Clear Token
            </button>
          )}
        </div>
        {currentToken && (
          <div className="mt-2 text-xs text-gray-500 font-mono break-all">
            {currentToken.substring(0, 20)}...{currentToken.substring(currentToken.length - 10)}
          </div>
        )}
      </div>
      
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {availableLanguages.map((key) => (
            <button
              key={key}
              onClick={() => setActiveLanguage(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeLanguage === key
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {codeSnippets[key]?.label || key}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm">
            <code className="whitespace-pre-wrap break-words">
              {codeSnippets[activeLanguage]?.source || 'Code not available'}
            </code>
          </pre>
          <button
            onClick={() => handleCopy(codeSnippets[activeLanguage]?.source || '', activeLanguage)}
            className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
            title={t.common.copyToClipboard}
          >
            {copiedCode === activeLanguage ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-300" />
            )}
          </button>
        </div>
      </div>

      {/* Interactive Parameter/Request Body Input */}
      {(hasParameters || hasFormUrlencodedBody || hasRequestBody) && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t.common.customizeRequest}
            </h4>
            <button
              onClick={() => setShowParameterInput(!showParameterInput)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showParameterInput ? t.common.hideInput : t.common.showInput}
            </button>
          </div>

          {showParameterInput && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {/* Parameters Input */}
              {(allParameters.length > 0 || hasFormUrlencodedBody) && (
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-3">{t.common.parameters}:</h5>
                  <div className="space-y-3">
                    {allParameters.map((param) => (
                      <div key={param.name} className="flex flex-col">
                        <label className="text-xs font-medium text-gray-600 mb-1">
                          {param.name} 
                          <span className="text-gray-400">({param.in})</span>
                          {(param.required || param.in === 'path') && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          value={currentParameterValues[param.name] || ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                          placeholder={
                            param.name === 'from'
                              ? '2026-03-01'
                              : param.name === 'to'
                                ? '2026-03-31'
                                : t.common.enterParameter.replace('{parameter}', param.name)
                          }
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {(param.description || (param as any).description) && (
                          <span className="text-xs text-gray-500 mt-1">{param.description || (param as any).description}</span>
                        )}
                      </div>
                    ))}
                    
                    {/* Form-urlencoded body parameters */}
                    {hasFormUrlencodedBody && (() => {
                      const content = requestBody.content['application/x-www-form-urlencoded'];
                      const schema = content.schema;
                      if (!schema || !schema.properties) return null;
                      
                      return Object.entries(schema.properties).map(([propName, propSchema]: [string, any]) => (
                        <div key={propName} className="flex flex-col">
                          <label className="text-xs font-medium text-gray-600 mb-1">
                            {propName} 
                            <span className="text-gray-400">({t.common.bodyParameter})</span>
                            {schema.required?.includes(propName) && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <input
                            type="text"
                            value={currentParameterValues[propName] || ''}
                            onChange={(e) => handleParameterChange(propName, e.target.value)}
                            placeholder={t.common.enterParameter.replace('{parameter}', propName)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {propSchema.description && (
                            <span className="text-xs text-gray-500 mt-1">{propSchema.description}</span>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Request Body Input */}
              {hasRequestBody && (
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-3">{t.common.requestBody}:</h5>
                  <textarea
                    value={currentRequestBodyValue}
                    onChange={(e) => handleRequestBodyChange(e.target.value)}
                    placeholder={t.common.enterJsonRequestBody}
                    rows={14}
                    className="w-full min-h-[22rem] px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">
                      {t.common.contentType}: {Object.keys(requestBody.content)[0]}
                    </span>
                    <button
                      onClick={() => {
                        try {
                          const formatted = JSON.stringify(JSON.parse(currentRequestBodyValue), null, 2);
                          handleRequestBodyChange(formatted);
                        } catch (e) {
                          // Invalid JSON, do nothing
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {t.common.formatJson}
                    </button>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={regenerateCodeWithCustomValues}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                <Play className="w-4 h-4" />
                {isLoading ? t.common.generating : t.common.updateCodeExamples}
              </button>
              <button
                onClick={handleTestApi}
                disabled={isTestingApi}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors mt-2"
              >
                {isTestingApi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.common.testing}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t.common.testApiRequest}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* API Test Response */}
      {currentShowTestResponse && currentTestResponse && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              {currentTestResponse.error ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : currentTestResponse.status >= 200 && currentTestResponse.status < 300 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              {t.common.apiResponse}
            </h4>
            <button
              onClick={() => setShowTestResponse(prev => ({
                ...prev,
                [endpoint.id]: false
              }))}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t.common.hide}
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Response Status */}
            <div className={`px-4 py-3 text-sm font-medium ${
              currentTestResponse.error ? 'bg-red-50 text-red-800' :
              currentTestResponse.status >= 200 && currentTestResponse.status < 300 ? 'bg-green-50 text-green-800' :
              currentTestResponse.status >= 400 && currentTestResponse.status < 500 ? 'bg-yellow-50 text-yellow-800' :
              'bg-red-50 text-red-800'
            }`}>
              {currentTestResponse.error ? (
                `❌ ${currentTestResponse.error}`
              ) : (
                `${currentTestResponse.status} ${currentTestResponse.statusText} • ${currentTestResponse.responseTime}ms`
              )}
            </div>
            
            {/* Response Body */}
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm max-h-96">
                <code className="whitespace-pre-wrap break-words">
                  {formatApiResponse(currentTestResponse)}
                </code>
              </pre>
              <button
                onClick={() => {
                  const responseText = formatApiResponse(currentTestResponse);
                  navigator.clipboard.writeText(responseText);
                }}
                className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
                title={t.common.copyResponse}
              >
                <Copy className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};