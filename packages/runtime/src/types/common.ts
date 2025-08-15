export interface OpenAPISpec {
  openapi: string;
  info: any;
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    parameters?: Record<string, any>;
    requestBodies?: Record<string, any>;
    responses?: Record<string, any>;
  };
  [key: string]: any;
}


interface SpecObject {
  type: 'object';
  spec: OpenAPISpec;
}

interface SpecUrl {
  type: 'url';
  spec: string;
}

interface SpecFile {
  type: 'file';
  spec: string;
}

export type SpecSource = SpecObject | SpecUrl | SpecFile;
