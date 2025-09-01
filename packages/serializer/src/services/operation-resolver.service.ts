import { Inject, Injectable } from "@nestjs/common";
import { OpenAPIRuntimeService } from "@nest-openapi/runtime";
import { OPENAPI_SERIALIZER_RUNTIME } from "../types/serializer-options.interface";
import { getHttpDetails, pathToRegex } from "../utils/path.util";

export interface ResolvedOperation {
  operationId?: string;
  openapiVersion: string;
  method: string;
  pathTemplate: string;
  responses: Record<string, any>;
}

@Injectable()
export class OperationResolverService {
  constructor(
    @Inject(OPENAPI_SERIALIZER_RUNTIME)
    private readonly runtime: OpenAPIRuntimeService,
  ) {}

  resolve(ctx: import("@nestjs/common").ExecutionContext): ResolvedOperation | undefined {
    const spec = this.runtime.spec;
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
    };
  }
}
