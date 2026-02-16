import { OpenAPIV3 } from 'openapi-types';
import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import { McpToolDefinition } from '../types/index';
import { shouldIncludeOperation } from './x-mcp.filter';

/**
 * Extracts tool definitions from an OpenAPI document
 *
 * @param api OpenAPI document
 * @returns Array of MCP tool definitions
 */
export function extractToolsFromApi(
  api: OpenAPIV3.Document,
  defaultInclude: boolean = true,
): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [];
  const usedNames = new Set<string>();
  const globalSecurity = api.security || [];

  if (!api.paths) return tools;

  for (const [path, pathItem] of Object.entries(api.paths)) {
    if (!pathItem) continue;

    for (const method of Object.values(OpenAPIV3.HttpMethods)) {
      const operation = pathItem[method as OpenAPIV3.HttpMethods];
      if (!operation) continue;

      // Apply x-mcp filtering
      if (
        !shouldIncludeOperation({
          root: api,
          pathItem,
          operation,
          defaultInclude,
        })
      ) {
        continue;
      }

      // Generate a unique name for the tool
      let baseName = operation.operationId || generateOperationId(method, path);
      if (!baseName) continue;

      // Sanitize the name to be MCP-compatible (only a-z, 0-9, _, -)
      baseName = baseName.replace(/\./g, '_').replace(/[^a-z0-9_-]/gi, '_');

      let finalToolName = baseName;
      let counter = 1;
      while (usedNames.has(finalToolName)) {
        finalToolName = `${baseName}_${counter++}`;
      }
      usedNames.add(finalToolName);

      // Get or create a description
      const description =
        operation.description || operation.summary || `Executes ${method.toUpperCase()} ${path}`;

      // Generate input schema and extract parameters
      const { inputSchema, parameters, requestBodyContentType } =
        generateInputSchemaAndDetails(operation, pathItem, api);
      const outputSchema = generateSuccessOutputSchema(operation, api);

      // Extract parameter details for execution
      const executionParameters = parameters.map((p) => ({ name: p.name, in: p.in }));

      // Determine security requirements
      const securityRequirements =
        operation.security === null ? globalSecurity : operation.security || globalSecurity;

      // Create the tool definition
      tools.push({
        name: finalToolName,
        description,
        inputSchema,
        outputSchema,
        method,
        pathTemplate: path,
        parameters,
        executionParameters,
        requestBodyContentType,
        securityRequirements,
        operationId: baseName,
      });
    }
  }

  return tools;
}

function generateOperationId(method: string, path: string): string {
  const cleanPath = path
    .replace(/\{([^}]+)\}/g, 'By_$1')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${method.toLowerCase()}_${cleanPath}`;
}

/**
 * Generates input schema and extracts parameter details from an operation
 *
 * @param operation OpenAPI operation object
 * @param pathItem OpenAPI path item object
 * @returns Input schema, parameters, and request body content type
 */
export function generateInputSchemaAndDetails(
  operation: OpenAPIV3.OperationObject,
  pathItem?: OpenAPIV3.PathItemObject,
  api?: OpenAPIV3.Document,
): {
  inputSchema: JSONSchema7;
  parameters: OpenAPIV3.ParameterObject[];
  requestBodyContentType?: string;
} {
  const properties: { [key: string]: JSONSchema7 | boolean } = {};
  const required: string[] = [];

  const resolveRef = (ref: string) => resolveOpenApiRef(api, ref);

  // Operation-level parameters override path-level parameters
  const pathParameters = resolveParameters(pathItem?.parameters, resolveRef);
  const operationParameters = resolveParameters(operation.parameters, resolveRef);
  const allParameters = mergeParameters(pathParameters, operationParameters);

  allParameters.forEach((param) => {
    if (!param.name || !param.schema) return;

    const paramSchema = mapOpenApiSchemaToJsonSchema(
      param.schema as OpenAPIV3.SchemaObject,
      resolveRef,
    );
    if (typeof paramSchema === 'object') {
      paramSchema.description = param.description || paramSchema.description;
    }

    properties[param.name] = paramSchema;
    if (param.required) required.push(param.name);
  });

  // Process request body (if present)
  let requestBodyContentType: string | undefined = undefined;

  if (operation.requestBody) {
    const opRequestBody =
      '$ref' in operation.requestBody
        ? (resolveRef(operation.requestBody.$ref) as OpenAPIV3.RequestBodyObject)
        : operation.requestBody;

    if (!opRequestBody) {
      return {
        inputSchema: {
          type: 'object',
          properties,
          ...(required.length > 0 && { required }),
          additionalProperties: false,
          $schema: 'http://json-schema.org/draft-07/schema#',
        },
        parameters: allParameters,
        requestBodyContentType,
      };
    }

    const jsonContent = opRequestBody.content?.['application/json'];
    const firstContent = opRequestBody.content
      ? Object.entries(opRequestBody.content)[0]
      : undefined;

    if (jsonContent?.schema) {
      requestBodyContentType = 'application/json';
      const bodySchema = mapOpenApiSchemaToJsonSchema(
        jsonContent.schema as OpenAPIV3.SchemaObject,
        resolveRef,
      );

      if (typeof bodySchema === 'object') {
        bodySchema.description =
          opRequestBody.description || bodySchema.description || 'The JSON request body.';
      }

      properties['requestBody'] = bodySchema;
      if (opRequestBody.required) required.push('requestBody');
    } else if (firstContent) {
      const [contentType] = firstContent;
      requestBodyContentType = contentType;

      properties['requestBody'] = {
        type: 'string',
        description: opRequestBody.description || `Request body (content type: ${contentType})`,
      };

      if (opRequestBody.required) required.push('requestBody');
    }
  }

  // Combine everything into a JSON Schema
  const inputSchema: JSONSchema7 = {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties: false,
    $schema: 'http://json-schema.org/draft-07/schema#',
  };

  return { inputSchema, parameters: allParameters, requestBodyContentType };
}

function generateSuccessOutputSchema(
  operation: OpenAPIV3.OperationObject,
  api?: OpenAPIV3.Document,
): JSONSchema7 | undefined {
  const responses = operation.responses;
  if (!responses) return undefined;

  const resolveRef = (ref: string) => resolveOpenApiRef(api, ref);
  const statusCodes = Object.keys(responses)
    .filter((code) => /^2\d\d$/.test(code))
    .sort((a, b) => Number(a) - Number(b));

  const candidateCodes = [
    ...statusCodes,
    ...(['2XX', '2xx'] as const).filter((code) => responses[code]),
  ];

  for (const code of candidateCodes) {
    const rawResponse = responses[code as keyof typeof responses];
    if (!rawResponse) continue;

    const response =
      '$ref' in rawResponse
        ? (resolveRef(rawResponse.$ref) as OpenAPIV3.ResponseObject)
        : rawResponse;
    if (!response?.content) continue;

    const jsonContent = response.content['application/json'];
    const schema = jsonContent?.schema;
    if (!schema) continue;

    const mapped = mapOpenApiSchemaToJsonSchema(
      schema as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
      resolveRef,
    );

    if (typeof mapped === 'object') return mapped;
  }

  return undefined;
}

function resolveParameters(
  params: Array<OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject> | undefined,
  resolveRef: (ref: string) => unknown,
): OpenAPIV3.ParameterObject[] {
  if (!Array.isArray(params)) return [];
  return params
    .map((p) => ('$ref' in p ? resolveRef(p.$ref) : p))
    .filter((p): p is OpenAPIV3.ParameterObject => !!p);
}

function mergeParameters(
  pathParameters: OpenAPIV3.ParameterObject[],
  operationParameters: OpenAPIV3.ParameterObject[],
): OpenAPIV3.ParameterObject[] {
  const merged = [...pathParameters];

  for (const operationParam of operationParameters) {
    const existingIndex = merged.findIndex(
      (pathParam) => pathParam.name === operationParam.name && pathParam.in === operationParam.in,
    );

    if (existingIndex >= 0) {
      merged[existingIndex] = operationParam;
    } else {
      merged.push(operationParam);
    }
  }

  return merged;
}

/**
 * Maps an OpenAPI schema to a JSON Schema with cycle protection.
 *
 * @param schema OpenAPI schema object or reference
 * @param seen WeakSet tracking already visited schema objects
 * @returns JSON Schema representation
 */
export function mapOpenApiSchemaToJsonSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  resolveRef?: (ref: string) => unknown,
  seen: WeakSet<object> = new WeakSet(),
): JSONSchema7 | boolean {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object' };
  }

  // Handle reference objects
  if ('$ref' in schema) {
    if (resolveRef) {
      const resolved = resolveRef(schema.$ref);
      if (resolved && typeof resolved === 'object') {
        return mapOpenApiSchemaToJsonSchema(
          resolved as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
          resolveRef,
          seen,
        );
      }
    }

    // Fallback for unresolved refs
    return { type: 'object' };
  }

  // Handle boolean schemas
  if (typeof schema === 'boolean') return schema;

  // Detect cycles
  if (seen.has(schema)) {
    return { type: 'object' };
  }
  seen.add(schema);

  try {
    // Create a copy of the schema to modify
    const jsonSchema: JSONSchema7 = { ...schema } as any;

    // Convert integer type to number (JSON Schema compatible)
    if (schema.type === 'integer') jsonSchema.type = 'number';

    // Remove OpenAPI-specific properties that aren't in JSON Schema
    delete (jsonSchema as any).nullable;
    delete (jsonSchema as any).example;
    delete (jsonSchema as any).xml;
    delete (jsonSchema as any).externalDocs;
    delete (jsonSchema as any).deprecated;
    delete (jsonSchema as any).readOnly;
    delete (jsonSchema as any).writeOnly;

    // Handle nullable properties by adding null to the type
    if (schema.nullable) {
      if (Array.isArray(jsonSchema.type)) {
        if (!jsonSchema.type.includes('null')) jsonSchema.type.push('null');
      } else if (typeof jsonSchema.type === 'string') {
        jsonSchema.type = [jsonSchema.type as JSONSchema7TypeName, 'null'];
      } else if (!jsonSchema.type) {
        jsonSchema.type = 'null';
      }
    }

    // Recursively process object properties
    if (jsonSchema.type === 'object' && jsonSchema.properties) {
      const mappedProps: { [key: string]: JSONSchema7 | boolean } = {};

      for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
        if (typeof propSchema === 'object' && propSchema !== null) {
          mappedProps[key] = mapOpenApiSchemaToJsonSchema(
            propSchema as any,
            resolveRef,
            seen,
          );
        } else if (typeof propSchema === 'boolean') {
          mappedProps[key] = propSchema;
        }
      }

      jsonSchema.properties = mappedProps;
    }

    // Recursively process array items
    if (
      jsonSchema.type === 'array' &&
      typeof jsonSchema.items === 'object' &&
      jsonSchema.items !== null
    ) {
      jsonSchema.items = mapOpenApiSchemaToJsonSchema(
        jsonSchema.items as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
        resolveRef,
        seen,
      );
    }

    if (Array.isArray((jsonSchema as any).allOf)) {
      (jsonSchema as any).allOf = (jsonSchema as any).allOf.map((item: any) =>
        mapOpenApiSchemaToJsonSchema(item, resolveRef, seen),
      );
    }

    if (Array.isArray((jsonSchema as any).anyOf)) {
      (jsonSchema as any).anyOf = (jsonSchema as any).anyOf.map((item: any) =>
        mapOpenApiSchemaToJsonSchema(item, resolveRef, seen),
      );
    }

    if (Array.isArray((jsonSchema as any).oneOf)) {
      (jsonSchema as any).oneOf = (jsonSchema as any).oneOf.map((item: any) =>
        mapOpenApiSchemaToJsonSchema(item, resolveRef, seen),
      );
    }

    if (typeof (jsonSchema as any).not === 'object' && (jsonSchema as any).not !== null) {
      (jsonSchema as any).not = mapOpenApiSchemaToJsonSchema(
        (jsonSchema as any).not,
        resolveRef,
        seen,
      );
    }

    if (
      typeof jsonSchema.additionalProperties === 'object' &&
      jsonSchema.additionalProperties !== null
    ) {
      jsonSchema.additionalProperties = mapOpenApiSchemaToJsonSchema(
        jsonSchema.additionalProperties as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
        resolveRef,
        seen,
      );
    }

    return jsonSchema;
  } finally {
    seen.delete(schema);
  }
}

function resolveOpenApiRef(api: OpenAPIV3.Document | undefined, ref: string): unknown {
  if (!api || !ref || !ref.startsWith('#/')) return undefined;

  const pointer = ref.slice(2).split('/').map(unescapeJsonPointerSegment);
  let current: any = api;

  for (const segment of pointer) {
    if ((current === null || current === undefined) || typeof current !== 'object') return undefined;
    current = current[segment];
  }

  return current;
}

function unescapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}
