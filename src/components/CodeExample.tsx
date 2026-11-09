import React, { useState } from 'react';
import { Copy, Check, Send, Loader2, CheckCircle, XCircle, Pencil } from 'lucide-react';
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

  const hasEditor = hasParameters || !!hasFormUrlencodedBody || !!hasRequestBody;
  const EDIT_TAB = 'edit';

  // Build code snippets from the current request (debounced while typing).
  // Only the first build shows a loader, so the editor keeps focus while typing.
  const firstBuildDone = React.useRef(false);
  // The JSON editor grows to fit its content (wrapped long lines included).
  const bodyEditorRef = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = bodyEditorRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  });
  React.useEffect(() => {
    if (!spec) return;
    if (hasJsonRequestBody && !currentRequestBodyValue) return; // wait for the editor to initialise
    let cancelled = false;
    const build = async () => {
      try {
        const snippets = await generateCodeSnippets({
          endpoint: { ...endpoint, customParameterValues: currentParameterValues, customRequestBody: currentRequestBodyValue } as any,
          baseUrl,
          spec,
        });
        if (!cancelled) setCodeSnippets(snippets);
      } catch (error) {
        console.error('Failed to generate code snippets:', error);
        if (!cancelled) setCodeSnippets({});
      } finally {
        if (!cancelled) {
          firstBuildDone.current = true;
          setIsLoading(false);
        }
      }
    };
    const timer = setTimeout(build, firstBuildDone.current ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [endpoint.id, baseUrl, spec, currentRequestBodyValue, JSON.stringify(currentParameterValues)]);

  // When the method changes, open the editable request first.
  React.useEffect(() => {
    setActiveLanguage(hasEditor ? EDIT_TAB : 'curl');
  }, [endpoint.id]);

  React.useEffect(() => {
    if (activeLanguage === EDIT_TAB) return;
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

  const formUrlencodedProps: [string, any][] = hasFormUrlencodedBody
    ? Object.entries(requestBody.content['application/x-www-form-urlencoded']?.schema?.properties || {})
    : [];
  const formUrlencodedRequired: string[] = hasFormUrlencodedBody
    ? requestBody.content['application/x-www-form-urlencoded']?.schema?.required || []
    : [];
  const bodyLines = Math.max(3, currentRequestBodyValue.split('\n').length);
  const isEditTab = activeLanguage === EDIT_TAB;
  const copySource = isEditTab ? currentRequestBodyValue : codeSnippets[activeLanguage]?.source || '';

  const inputRow = (
    key: string,
    label: React.ReactNode,
    value: string,
    placeholder: string,
    description?: string,
  ) => (
    <div key={key} className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-1 sm:gap-3 items-center">
      <label className="text-xs font-medium text-gray-700 font-mono break-all" title={description}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => handleParameterChange(key, e.target.value)}
        placeholder={placeholder}
        title={description}
        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-paynet-primary focus:border-transparent"
      />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{t.common.codeExamples}</h3>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className={`w-2 h-2 rounded-full ${currentToken ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          <span title={currentToken ? `${currentToken.substring(0, 20)}…` : undefined}>
            Auth Token: {currentToken ? 'Active' : 'Not Set'}
          </span>
          {currentToken && (
            <button
              onClick={() => {
                clearAuthToken();
                setCurrentToken(null);
              }}
              className="text-red-600 hover:text-red-800 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg">
        <div className="flex flex-wrap border-b border-gray-200 bg-gray-50 rounded-t-lg overflow-hidden">
          {hasEditor && (
            <button
              key={EDIT_TAB}
              onClick={() => setActiveLanguage(EDIT_TAB)}
              className={`px-4 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                isEditTab
                  ? 'bg-white text-paynet-primary border-b-2 border-paynet-primary'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              {hasRequestBody ? 'JSON' : t.common.parameters}
            </button>
          )}
          {availableLanguages.map((key) => (
            <button
              key={key}
              onClick={() => setActiveLanguage(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeLanguage === key
                  ? 'bg-white text-paynet-primary border-b-2 border-paynet-primary'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {codeSnippets[key]?.label || key}
            </button>
          ))}
        </div>

        {isEditTab ? (
          <div className="p-4 bg-white space-y-3">
            {(allParameters.length > 0 || formUrlencodedProps.length > 0) && (
              <div className="space-y-2">
                {allParameters.map((param) =>
                  inputRow(
                    param.name,
                    <>
                      {param.name}
                      <span className="text-gray-400 font-sans"> ({param.in})</span>
                      {(param.required || param.in === 'path') && <span className="text-red-500 ml-0.5">*</span>}
                    </>,
                    currentParameterValues[param.name] || '',
                    param.name === 'from'
                      ? '2026-03-01'
                      : param.name === 'to'
                        ? '2026-03-31'
                        : t.common.enterParameter.replace('{parameter}', param.name),
                    param.description,
                  ),
                )}
                {formUrlencodedProps.map(([propName, propSchema]) =>
                  inputRow(
                    propName,
                    <>
                      {propName}
                      {formUrlencodedRequired.includes(propName) && <span className="text-red-500 ml-0.5">*</span>}
                    </>,
                    currentParameterValues[propName] || '',
                    t.common.enterParameter.replace('{parameter}', propName),
                    propSchema?.description,
                  ),
                )}
              </div>
            )}

            {hasRequestBody && (
              <div>
                <textarea
                  ref={bodyEditorRef}
                  value={currentRequestBodyValue}
                  onChange={(e) => handleRequestBodyChange(e.target.value)}
                  placeholder={t.common.enterJsonRequestBody}
                  rows={bodyLines}
                  spellCheck={false}
                  aria-label={t.common.requestBody}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono leading-5 resize-none overflow-hidden focus:ring-2 focus:ring-paynet-primary focus:border-transparent"
                />
                <div className="flex justify-between items-center mt-1 gap-3">
                  <span className="text-xs text-gray-500">
                    {t.common.contentType}: {Object.keys(requestBody.content)[0]}
                  </span>
                  <button
                    onClick={() => {
                      try {
                        handleRequestBodyChange(JSON.stringify(JSON.parse(currentRequestBodyValue), null, 2));
                      } catch (e) {
                        // Invalid JSON, keep as typed
                      }
                    }}
                    className="text-xs text-paynet-primary hover:underline"
                  >
                    {t.common.formatJson}
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500">{t.common.codeSyncHint}</p>
          </div>
        ) : (
          <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm m-0">
            <code className="whitespace-pre-wrap break-words">
              {codeSnippets[activeLanguage]?.source || 'Code not available'}
            </code>
          </pre>
        )}

        {/* Sticks to the bottom of the panel, so Test stays reachable with a long request */}
        <div className="sticky bottom-0 z-10 flex items-center gap-2 p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={handleTestApi}
            disabled={isTestingApi}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
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
          <button
            onClick={() => handleCopy(copySource, activeLanguage)}
            className="p-2 border border-gray-300 bg-white hover:bg-gray-100 rounded-md transition-colors"
            title={t.common.copyToClipboard}
            aria-label={t.common.copyToClipboard}
          >
            {copiedCode === activeLanguage ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

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
