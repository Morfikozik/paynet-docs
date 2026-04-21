export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: {
    [path: string]: {
      [method: string]: {
        summary: string;
        description: string;
        parameters?: Array<{
          name: string;
          in: string;
          description: string;
          required: boolean;
          schema: {
            type: string;
          };
        }>;
        requestBody?: {
          description?: string;
          required?: boolean;
          content: {
            [mediaType: string]: {
              schema: any;
              example?: any;
            };
          };
        };
        responses: {
          [statusCode: string]: {
            description: string;
            content?: {
              [mediaType: string]: {
                schema: any;
              };
            };
          };
        };
        tags: string[];
      };
    };
  };
  components: {
    securitySchemes: {
      [name: string]: {
        type: string;
        scheme?: string;
        bearerFormat?: string;
        in?: string;
        name?: string;
      };
    };
  };
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  endpoints: Endpoint[];
}

export interface Endpoint {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters?: Parameter[];
  responses: Record<string, any>;
}

export interface Parameter {
  name: string;
  in: string;
  description: string;
  required: boolean;
  type: string;
}