import type { OpenAPISpec } from '@nest-openapi/runtime';
import { getIncludedOperations } from './x-mcp.filter';
import { withStableUniqueNames } from './tool.naming';
import { extractToolsFromApi } from './tool-extractor';
import { OpenAPIV3 } from 'openapi-types';
import type { McpToolDefinition } from '../types';

export async function buildMcpToolsFromSpec(args: {
  spec: OpenAPISpec;
  baseUrl: string;
  tools: { defaultInclude: boolean; namePrefix?: string };
}): Promise<Array<McpToolDefinition>> {
  const generated = extractToolsFromApi(args.spec as OpenAPIV3.Document, args.tools.defaultInclude);

  const included = getIncludedOperations(args.spec, args.tools.defaultInclude);
  const allowedKeys = new Set(included.map((x) => `${x.method.toLowerCase()} ${x.path}`));

  const mapped = generated
    .filter((tool) => {
      const method = String(tool.method ?? '').toLowerCase();
      const pathTemplate = String(tool.pathTemplate ?? '');

      return allowedKeys.has(`${method} ${pathTemplate}`);
    })
    .map((tool) => ({
      operationId: tool.operationId,
      name: args.tools.namePrefix ? `${args.tools.namePrefix}${tool.name}` : tool.name,
      description: tool.description,
      method: tool.method.toLowerCase(),
      pathTemplate: tool.pathTemplate,
      inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
      outputSchema: tool.outputSchema,
      executionParameters: tool.executionParameters,
      requestBodyContentType: tool.requestBodyContentType,
      securityRequirements: tool.securityRequirements,
      parameters: tool.parameters,
    })) satisfies McpToolDefinition[];

  return withStableUniqueNames(mapped);
}
