import type { JSONSchema7 } from 'json-schema';
import { OpenAPIV3 } from 'openapi-types';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
  outputSchema?: JSONSchema7;
  method: string;
  pathTemplate: string;
  parameters: OpenAPIV3.ParameterObject[];
  executionParameters: { name: string; in: string }[];
  requestBodyContentType?: string;
  securityRequirements: OpenAPIV3.SecurityRequirementObject[];
  operationId: string;
}
