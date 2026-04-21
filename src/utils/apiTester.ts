import { Endpoint } from '../types/api';
import { OpenAPISpec } from '../types/api';

export interface ApiTestRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ApiTestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
  error?: string;
}

// Token storage
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('tps_api_token', token);
  } else {
    localStorage.removeItem('tps_api_token');
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  
  // Try to get from localStorage
  const stored = localStorage.getItem('tps_api_token');
  if (stored) {
    authToken = stored;
    return stored;
  }
  
  return null;
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('tps_api_token');
}

// Generate example values based on parameter type and schema
function generateExampleValue(param: any, customValue?: string): any {
  // Use custom value if provided
  if (customValue !== undefined && customValue !== '') {
    // Try to parse as appropriate type
    const { type } = param.schema || param;
    switch (type) {
      case 'integer':
        const intValue = parseInt(customValue);
        return isNaN(intValue) ? customValue : intValue;
      case 'number':
        const numValue = parseFloat(customValue);
        return isNaN(numValue) ? customValue : numValue;
      case 'boolean':
        return customValue.toLowerCase() === 'true';
      default:
        return customValue;
    }
  }

  const { type, format, example, enum: enumValues, schema } = param.schema || param;
  
  if (example !== undefined) return example;
  if (enumValues && enumValues.length > 0) return enumValues[0];
  
  switch (type) {
    case 'string':
      if (format === 'date') return '2024-01-01';
      if (format === 'date-time') return '2024-01-01T00:00:00Z';
      if (format === 'email') return 'user@example.com';
      if (format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
      if (param.name?.toLowerCase().includes('id')) return 'example_id';
      return `example_${param.name || 'value'}`;
    case 'integer':
      return 123;
    case 'number':
      return 123.45;
    case 'boolean':
      return true;
    case 'array':
      return [generateExampleValue({ schema: schema?.items || { type: 'string' } })];
    case 'object':
      return {};
    default:
      return `example_${param.name || 'value'}`;
  }
}

// Generate example object from JSON schema
function generateExampleFromSchema(schema: any): any {
  if (schema.example) return schema.example;
  
  switch (schema.type) {
    case 'object':
      const obj: any = {};
      if (schema.properties) {
        Object.keys(schema.properties).forEach(key => {
          obj[key] = generateExampleFromSchema(schema.properties[key]);
        });
      }
      return obj;
    case 'array':
      return schema.items ? [generateExampleFromSchema(schema.items)] : [];
    case 'string':
      if (schema.format === 'date') return '2024-01-01';
      if (schema.format === 'date-time') return '2024-01-01T00:00:00Z';
      if (schema.format === 'email') return 'user@example.com';
      return schema.enum?.[0] || 'example_string';
    case 'integer':
      return schema.enum?.[0] || 123;
    case 'number':
      return schema.enum?.[0] || 123.45;
    case 'boolean':
      return true;
    default:
      return null;
  }
}

// Build request object for API testing
export function buildTestRequest(
  endpoint: Endpoint, 
  spec: OpenAPISpec, 
  parameterValues: Record<string, string> = {},
  requestBodyValue: string = ''
): ApiTestRequest {
  // Extract path parameters from URL pattern (like {invoice_id})
  const pathParametersFromUrl = endpoint.path.match(/\{([^}]+)\}/g)?.map(match => ({
    name: match.slice(1, -1), // Remove { and }
    in: 'path',
    required: true,
    schema: { type: 'string' }
  })) || [];
  
  // Combine regular parameters with path parameters from URL
  const allParameters = [
    ...(endpoint.parameters || []),
    ...pathParametersFromUrl.filter(pathParam => 
      !endpoint.parameters?.some(param => param.name === pathParam.name)
    )
  ];

  // Get sandbox server URL
  let serverUrl = 'https://ecom-api-test.paynet.md'; // fallback
  
  if (spec.servers && spec.servers.length > 0) {
    // Find sandbox server
    const sandboxServer = spec.servers.find(server => 
      server.description?.toLowerCase().includes('sandbox') || 
      server.url?.toLowerCase().includes('test')
    );
    if (sandboxServer) {
      serverUrl = sandboxServer.url;
    } else {
      // Use second server if available (often test/staging)
      serverUrl = spec.servers.length > 1 ? spec.servers[1].url : spec.servers[0].url;
    }
  }

  const pathParams = allParameters.filter(p => p.in === 'path');
  const queryParams = allParameters.filter(p => p.in === 'query');
  const headerParams = allParameters.filter(p => p.in === 'header');
  
  // Build path with parameters
  let path = endpoint.path;
  pathParams.forEach(param => {
    const exampleValue = generateExampleValue(param, parameterValues[param.name]);
    path = path.replace(`{${param.name}}`, String(exampleValue));
  });
  
  // Build query parameters
  const queryString = queryParams.length > 0 
    ? '?' + queryParams.map(param => {
        const value = generateExampleValue(param, parameterValues[param.name]);
        return `${param.name}=${encodeURIComponent(String(value))}`;
      }).join('&')
    : '';
  
  // Build headers
  const headers: Record<string, string> = {};
  headers['Accept-Language'] = 'en-US';

  // Determine Content-Type based on requestBody or parameters
  if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    // Get request body from OpenAPI spec
    const operation = spec.paths[endpoint.path]?.[endpoint.method.toLowerCase()];
    const requestBody = operation?.requestBody;
    
    if (requestBody?.content && Object.keys(requestBody.content).length > 0) {
      // Use Content-Type from requestBody.content (first available)
      const contentTypes = Object.keys(requestBody.content);
      headers['Content-Type'] = contentTypes[0];
    } else if (endpoint.parameters && endpoint.parameters.length > 0) {
      // If parameters exist but no requestBody, use form-urlencoded
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else {
      // Default fallback
      headers['Content-Type'] = 'application/json';
    }
  }
  
  // Add authentication headers (exclude auth endpoint)
  if (path !== "/auth") {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Authorization'] = 'Bearer {{_token_}}';
    }
  }
  
  // Add custom headers from parameters
  headerParams.forEach(param => {
    headers[param.name] = String(generateExampleValue(param, parameterValues[param.name]));
  });
  
  // Build request body for POST/PUT/PATCH
  let body;
  if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    // Try to get request body schema from OpenAPI spec
    const operation = spec.paths[endpoint.path]?.[endpoint.method.toLowerCase()];
    const requestBody = operation?.requestBody;
    
    if (requestBody?.content) {
      // Check for application/x-www-form-urlencoded first
      if (requestBody.content['application/x-www-form-urlencoded']) {
        // Build form data from parameter values
        const formData: Record<string, any> = {};
        const schema = requestBody.content['application/x-www-form-urlencoded'].schema;
        
        if (schema && schema.properties) {
          Object.keys(schema.properties).forEach(key => {
            const customValue = parameterValues[key];
            if (customValue !== undefined && customValue !== '') {
              formData[key] = customValue;
            } else if (schema.properties[key].example !== undefined) {
              formData[key] = schema.properties[key].example;
            } else {
              formData[key] = generateExampleValue({ schema: schema.properties[key], name: key });
            }
          });
        }
        
        // Convert to URL-encoded string
        body = Object.entries(formData)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&');
      }
      // Check for application/json
      else if (requestBody.content['application/json']) {
        // Use custom request body if provided
        if (requestBodyValue && requestBodyValue.trim()) {
          try {
            // Try to parse as JSON first
            JSON.parse(requestBodyValue);
            body = requestBodyValue;
          } catch (e) {
            // If parsing fails, use as string
            body = requestBodyValue;
          }
        } else if (requestBody.content['application/json'].example) {
          // Use provided example
          body = JSON.stringify(requestBody.content['application/json'].example, null, 2);
        } else if (requestBody.content['application/json'].schema) {
          // Generate from schema
          body = JSON.stringify(generateExampleFromSchema(requestBody.content['application/json'].schema), null, 2);
        }
      }
    }
  }
  
  return {
    method: endpoint.method,
    url: `${serverUrl}${path}${queryString}`,
    headers,
    ...(body && { body })
  };
}

// Execute API test request
export async function executeApiTest(request: ApiTestRequest): Promise<ApiTestResponse> {
  const startTime = Date.now();
  
  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        ...request.headers
      },
      ...(request.body && { body: request.body })
    };

    const response = await fetch(request.url, fetchOptions);
    const responseTime = Date.now() - startTime;
    
    // Get response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Handle different content types
    let data;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/vnd.ms-excel')) {
        // Handle Excel file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `download_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        data = `Excel file downloaded successfully (${blob.size} bytes)`;
      } else if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (parseError) {
      data = await response.text();
    }
    
    // Check if this is an auth request and save token
    if (request.url.includes('/auth') && response.status === 200 && data && typeof data === 'object') {
      if (data.access_token) {
        setAuthToken(data.access_token);
        console.log('✅ Auth token saved successfully');
      }
    }
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      responseTime
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Check if it's a CORS error and provide helpful message
    const isCorsError = error instanceof TypeError && 
                       (error.message.includes('CORS') || 
                        error.message.includes('Network request failed') ||
                        error.message.includes('Failed to fetch'));
    
    return {
      status: 0,
      statusText: isCorsError ? 'CORS Policy Restriction' : 'Network Error',
      headers: {},
      data: null,
      responseTime,
      error: isCorsError 
        ? `CORS policy prevents direct API testing from browser for ${request.url}. The server needs to allow cross-origin requests. Use the generated code examples in your backend or API testing tools like Postman.`
        : (error instanceof Error ? error.message : 'Unknown error occurred')
    };
  }
}

// Format response for display
export function formatApiResponse(response: ApiTestResponse): string {
  if (response.error) {
    return `❌ Error: ${response.error}\nResponse Time: ${response.responseTime}ms`;
  }
  
  let formatted = `Status: ${response.status} ${response.statusText}\n`;
  formatted += `Response Time: ${response.responseTime}ms\n\n`;
  
  // Add important headers
  if (response.headers['content-type']) {
    formatted += `Content-Type: ${response.headers['content-type']}\n`;
  }
  if (response.headers['content-length']) {
    formatted += `Content-Length: ${response.headers['content-length']}\n`;
  }
  
  formatted += '\nResponse Body:\n';
  
  if (typeof response.data === 'object') {
    formatted += JSON.stringify(response.data, null, 2);
  } else {
    formatted += String(response.data);
  }
  
  return formatted;
}