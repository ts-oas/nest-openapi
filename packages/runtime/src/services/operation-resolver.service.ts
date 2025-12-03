import { ExecutionContext, Injectable } from "@nestjs/common";
import { getHttpDetails, pathToRegex } from "../utils/path.util";
import { OpenAPISpec } from "../types";

export interface ResolvedOperation {
  operationId?: string;
  openapiVersion: string;
  method: string;
  pathTemplate: string;
  responses: Record<string, any>;
  requestBody?: any;
}

@Injectable()
export class OperationResolverService {
  constructor(private readonly spec: OpenAPISpec) {}

  /**
   * Resolve the OpenAPI operation for the given request context.
   *
   * @param ctx - NestJS ExecutionContext
   * @returns Resolved operation details or undefined if not found
   */
  resolve(ctx: ExecutionContext): ResolvedOperation | undefined {
    const spec = this.spec;
    if (!spec) return undefined;

    const { method, rawPath } = getHttpDetails(ctx);
    const paths = spec.paths || {};

    // Direct match first
    let matchPath: string | undefined;
    for (const p of Object.keys(paths)) {
      const re = pathToRegex(p);
      if (re.test(rawPath)) {
        matchPath = p;
        break;
      }
    }
    if (!matchPath) return undefined;

    const op = (paths as any)[matchPath]?.[method];
    if (!op) return undefined;

    return {
      operationId: op.operationId,
      openapiVersion: (spec.openapi || "3.0").toString(),
      method,
      pathTemplate: matchPath,
      responses: op.responses || {},
      requestBody: op.requestBody,
    };
  }
}

