import { Injectable, Logger } from '@nestjs/common';
import { OpenAPISpec } from '../types';

@Injectable()
export class SchemaResolverService {
  private readonly logger = new Logger('OpenApiValidator');

  constructor(private readonly spec: OpenAPISpec) {}

  /**
   * Resolve a schema reference ($ref) to its actual schema
   */
  resolveSchema (schema: any): any {
    if (!schema || !schema.$ref) return schema;

    const refPath = schema.$ref.replace('#/', '').split('/');
    let resolved: any = this.spec;

    for (const segment of refPath) {
      resolved = resolved?.[segment];
      if (!resolved) {
        this.logger.warn(`Failed to resolve schema reference $ref: ${schema.$ref}, segment: ${segment}`);
        return null
      };
    }

    return resolved;
  }

  /**
   * Extract request body schema from OpenAPI operation
   */
  extractBodySchema (requestBody: any): any {
    if (!requestBody?.content) return null;


    // Try to find JSON content type first
    const contentTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
    ];

    for (const contentType of contentTypes) {
      const content = requestBody.content[contentType];
      if (content?.schema) {
        return this.resolveSchema(content.schema);
      }
    }

    // If no preferred content type found, use the first available
    const firstContentType = Object.keys(requestBody.content)[0];
    if (firstContentType && requestBody.content[firstContentType]?.schema) {
      return this.resolveSchema(requestBody.content[firstContentType].schema);
    }

    return null;
  }

  /**
   * Extract parameter schemas from OpenAPI operation
   */
  extractParameterSchemas(parameters: any[] = []): {
    path: any[];
    query: any[];
    header: any[];
  } {
    const result = {
      path: [] as any[],
      query: [] as any[],
      header: [] as any[],
    };

    for (const param of parameters) {
      const resolvedParam = this.resolveSchema(param);
      if (!resolvedParam) continue;

      switch (resolvedParam.in) {
        case 'path':
          result.path.push(resolvedParam);
          break;

        case 'query':
          result.query.push(resolvedParam);
          break;

        case 'header':
          result.header.push(resolvedParam);
          break;

        default:
          break;
      }
    }

    return result;
  }

  /**
   * Extract response schema from OpenAPI operation
   */
  extractResponseSchema (responses: any, statusCode: string | number): any {
    if (!responses) return null;

    let response = responses[statusCode] || responses['default'];
    if (!response) return null;

    if (response.$ref) response = this.resolveSchema(response);
    if (!response?.content) return null;

    // Try JSON content type first
    const jsonContent = response.content['application/json'];
    if (jsonContent?.schema) return this.resolveSchema(jsonContent.schema);

    // If no JSON content, use the first available content type
    const firstContentType = Object.keys(response.content)[0];
    if (firstContentType && response.content[firstContentType]?.schema) {
      return this.resolveSchema(response.content[firstContentType].schema);
    }

    return null;
  }
}
