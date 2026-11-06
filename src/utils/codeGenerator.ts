import { OpenAPISpec, Endpoint } from '../types/api';
import { getAuthToken } from './apiTester';

// Types for code generation
interface CodeSnippet {
  language: string;
  label: string;
  source: string;
}

interface GenerateCodeOptions {
  endpoint: Endpoint;
  baseUrl: string;
  spec: OpenAPISpec;
}

// Language configurations for openapi-snippet
const LANGUAGE_CONFIGS = {
  curl: { target: 'shell', client: 'curl' },
  javascript: { target: 'javascript', client: 'fetch' },
  node: { target: 'node', client: 'native' },
  python: { target: 'python', client: 'requests' },
  php: { target: 'php', client: 'curl' },
  java: { target: 'java', client: 'okhttp' },
  csharp: { target: 'csharp', client: 'httpclient' },
  go: { target: 'go', client: 'native' },
  ruby: { target: 'ruby', client: 'native' }
};

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

// Build request object for openapi-snippet
function buildRequestObject(endpoint: Endpoint, baseUrl: string, spec: OpenAPISpec, preferSandbox: boolean = true) {
  // Get custom values if available
  const customParameterValues = (endpoint as any).customParameterValues || {};
  const customRequestBody = (endpoint as any).customRequestBody;

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

  // Determine which server URL to use
  let serverUrl = baseUrl;
  if (preferSandbox && spec.servers && spec.servers.length > 0) {
    // Find sandbox server
    const sandboxServer = spec.servers.find(server => 
      server.description?.toLowerCase().includes('sandbox') || 
      server.url?.toLowerCase().includes('test')
    );
    if (sandboxServer) {
      serverUrl = sandboxServer.url;
    } else {
      // If no sandbox found, use the second server if available (often test/staging)
      serverUrl = spec.servers.length > 1 ? spec.servers[1].url : spec.servers[0].url;
    }
  }

  const pathParams = allParameters.filter(p => p.in === 'path');
  const queryParams = allParameters.filter(p => p.in === 'query');
  const headerParams = allParameters.filter(p => p.in === 'header');
  
  // Build path with parameters
  let path = endpoint.path;
  pathParams.forEach(param => {
    const exampleValue = generateExampleValue(param, customParameterValues[param.name]);
    path = path.replace(`{${param.name}}`, String(exampleValue));
  });
  
  // Build query parameters
  const queryString = queryParams.length > 0 
    ? '?' + queryParams.map(param => {
        const value = generateExampleValue(param, customParameterValues[param.name]);
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
  
  // Add authentication headers
  if (spec.components?.securitySchemes) {
    // Add token for all requests except auth; fall back to placeholder.
    if (path !== '/auth') {
      const token = getAuthToken();
      headers['Authorization'] = token ? `Bearer ${token}` : 'Bearer {{_token_}}';
    }
  }
  
  // Add custom headers from parameters
  headerParams.forEach(param => {
    headers[param.name] = String(generateExampleValue(param, customParameterValues[param.name]));
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
        // Build form data from custom parameter values
        const formData: Record<string, any> = {};
        const schema = requestBody.content['application/x-www-form-urlencoded'].schema;
        
        if (schema && schema.properties) {
          Object.keys(schema.properties).forEach(key => {
            const customValue = customParameterValues[key];
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
        if (customRequestBody) {
          try {
            body = JSON.parse(customRequestBody);
          } catch (e) {
            // If parsing fails, use as string
            body = customRequestBody;
          }
        } else if (requestBody.content['application/json'].example) {
          // Use provided example
          body = requestBody.content['application/json'].example;
        } else if (requestBody.content['application/json'].schema) {
          // Generate from schema
          body = generateExampleFromSchema(requestBody.content['application/json'].schema);
        }
      }
    }
  }
  
  return {
    method: endpoint.method,
    url: `${serverUrl}${path}${queryString}`,
    headers,
    ...(body && { 
      body: typeof body === 'string' ? body : JSON.stringify(body, null, 2) 
    })
  };
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

// Fallback code generators for when openapi-snippet fails
const fallbackGenerators = {
  curl: (request: any) => {
    const headers = Object.entries(request.headers)
      .map(([key, value]) => `-H "${key}: ${value}"`)
      .join(' \\\n  ');
    
    const body = request.body ? ` \\\n  -d '${request.body}'` : '';
    
    return `curl -X ${request.method} \\\n  "${request.url}" \\\n  ${headers}${body}`;
  },
  
  javascript: (request: any) => {
    const options = {
      method: request.method,
      headers: request.headers,
      ...(request.body && { body: request.body })
    };
    
    return `const response = await fetch('${request.url}', ${JSON.stringify(options, null, 2)});

const data = await response.json();
console.log(data);`;
  },
  
  python: (request: any) => {
    const headers = JSON.stringify(request.headers, null, 2).replace(/"/g, "'");
    const body = request.body ? `\n\ndata = ${request.body}\nresponse = requests.${request.method.toLowerCase()}(url, headers=headers, json=data)` 
                              : `\n\nresponse = requests.${request.method.toLowerCase()}(url, headers=headers)`;
    
    return `import requests
import json

url = "${request.url}"
headers = ${headers}${body}

data = response.json()
print(data)`;
  },
  
  php: (request: any) => {
    const headers = Object.entries(request.headers)
      .map(([key, value]) => `    '${key}: ${value}'`)
      .join(',\n');
    
    const body = request.body ? `,\n  CURLOPT_POSTFIELDS => '${request.body.replace(/'/g, "\\'")}'` : '';
    
    return `<?php
$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => '${request.url}',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => '${request.method}',
  CURLOPT_HTTPHEADER => array(
${headers}
  )${body}
));

$response = curl_exec($curl);
curl_close($curl);

$data = json_decode($response, true);
print_r($data);
?>`;
  },
  
  java: (request: any) => {
    const headers = Object.entries(request.headers)
      .map(([key, value]) => `    .header("${key}", "${value}")`)
      .join('\n');
    
    const bodyMethod = request.body ? 
      `.POST(HttpRequest.BodyPublishers.ofString("${request.body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"))` : 
      `.${request.method}()`;
    
    return `import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${request.url}"))
${headers}
    ${bodyMethod}
    .build();

HttpResponse<String> response = client.send(request, 
    HttpResponse.BodyHandlers.ofString());

System.out.println(response.body());`;
  },
  
  csharp: (request: any) => {
    const headers = Object.entries(request.headers)
      .map(([key, value]) => `        client.DefaultRequestHeaders.Add("${key}", "${value}");`)
      .join('\n');
    
    let methodCall;
    if (request.method === 'GET') {
      methodCall = 'GetAsync(url)';
    } else if (request.body) {
      const escapedBody = request.body.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      methodCall = `${request.method === 'POST' ? 'PostAsync' : 
                   request.method === 'PUT' ? 'PutAsync' : 
                   'SendAsync'}(url, new StringContent("${escapedBody}", Encoding.UTF8, "application/json"))`;
    } else {
      methodCall = `${request.method}Async(url)`;
    }
    
    return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program
{
    private static readonly HttpClient client = new HttpClient();
    
    static async Task Main()
    {
${headers}
        
        string url = "${request.url}";
        
        HttpResponseMessage response = await client.${methodCall};
        string responseBody = await response.Content.ReadAsStringAsync();
        
        Console.WriteLine(responseBody);
    }
}`;
  }
};

// Main code generation function
export async function generateCodeSnippets({ endpoint, baseUrl, spec }: GenerateCodeOptions): Promise<Record<string, CodeSnippet>> {
  const request = buildRequestObject(endpoint, baseUrl, spec, true); // true = prefer sandbox
  const snippets: Record<string, CodeSnippet> = {};
  
  // Try to use openapi-snippet for each language
  for (const langKey of Object.keys(LANGUAGE_CONFIGS)) {
    try {
      // For now, use fallback generators since openapi-snippet requires more complex setup
      const fallbackGenerator = fallbackGenerators[langKey as keyof typeof fallbackGenerators];
      
      if (fallbackGenerator) {
        snippets[langKey] = {
          language: langKey,
          label: getLanguageLabel(langKey),
          source: fallbackGenerator(request)
        };
      }
    } catch (error) {
      console.warn(`Failed to generate ${langKey} code:`, error);
      
      // Fallback to basic template
      snippets[langKey] = {
        language: langKey,
        label: getLanguageLabel(langKey),
        source: `// Code generation failed for ${langKey}\n// Request: ${request.method} ${request.url}`
      };
    }
  }
  
  return snippets;
}

function getLanguageLabel(langKey: string): string {
  const labels: Record<string, string> = {
    curl: 'cURL',
    javascript: 'JavaScript',
    node: 'Node.js',
    python: 'Python',
    php: 'PHP',
    java: 'Java',
    csharp: 'C#',
    go: 'Go',
    ruby: 'Ruby'
  };
  
  return labels[langKey] || langKey.charAt(0).toUpperCase() + langKey.slice(1);
}

// Export for backward compatibility
export { generateExampleValue, buildRequestObject };