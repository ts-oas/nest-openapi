import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from "@nestjs/common";
import { DebugUtil, OpenAPIRuntimeService } from "@nest-openapi/runtime";
import fastJson, { type Options as StringifyOptions } from "fast-json-stringify";
import { bundleWithComponents, normalizeForResponse } from "../utils/oas-to-jsonschema.util";
import { OperationResolverService } from "./operation-resolver.service";
import {
  OPENAPI_SERIALIZER_OPTIONS,
  OPENAPI_SERIALIZER_RUNTIME,
  type SerializerOptions,
} from "../types/serializer-options.interface";

export type SerializerFn = (data: any) => string;

interface CacheKeyParts { operationId?: string; status: string; contentType: string }

function makeKey (parts: CacheKeyParts) {
  return `${parts.operationId || "_noop_"}|${parts.status}|${parts.contentType}`;
}

export const OPENAPI_SERIALIZER = Symbol('OPENAPI_SERIALIZER');

@Injectable()
export class OpenAPISerializerService implements OnApplicationBootstrap {
  private readonly logger = new Logger('OpenAPISerializer');
  private readonly debugLog: (message: string, ...args: any[]) => void;
  private readonly cache = new Map<string, SerializerFn>();

  constructor(
    @Inject(OPENAPI_SERIALIZER_RUNTIME)
    private readonly runtime: OpenAPIRuntimeService,
    @Inject(OperationResolverService)
    private readonly opResolver: OperationResolverService,
    @Optional() @Inject(OPENAPI_SERIALIZER_OPTIONS) readonly options: SerializerOptions,
  ) {
    this.debugLog = DebugUtil.createDebugFn(this.logger, this.options.debug || false);
  }

  async onApplicationBootstrap () {
    if (this.options.precompileSchemas) {
      this.precompileAll().catch((err) =>
        this.logger.warn(`Precompile failed: ${err?.message || err}`),
      );
    }
  }

  serializeResponse (
    ctx: import("@nestjs/common").ExecutionContext,
    statusCode: number,
    body: any,
    preferContentType?: string,
  ): ({ contentType: string; operationId: string; } & ({ stringified: string; } | { error: string; })) | undefined {
    const rsOpts = this.options.responseSerialization ?? { enable: true, skipErrorResponses: true };
    if (rsOpts.enable === false) return undefined;
    if ((rsOpts.skipErrorResponses ?? true) && statusCode >= 400) return undefined;

    const resolved = this.opResolver.resolve(ctx);
    if (!resolved) return undefined;

    // Find the best matching response + content
    const { schema, contentType, status, operationId } = this.findResponseSchema(
      resolved,
      statusCode,
      preferContentType,
    ) || {} as any;

    if (!schema || !contentType) return undefined;

    const serializer = this.getOrCompile({
      operationId,
      status,
      contentType,
      schema,
      openapiVersion: resolved.openapiVersion,
    });

    try {
      const stringified = serializer(body);
      return { stringified, contentType, operationId };
    } catch (error: any) {
      return { error: error.message, operationId, contentType };
    }
  }

  private findResponseSchema (
    resolved: import("./operation-resolver.service").ResolvedOperation,
    statusCode: number,
    preferContentType?: string,
  ) {
    const status = String(statusCode);
    const responses = resolved.responses || {};
    const candidateStatus = responses[status] ? status : (responses["default"] ? "default" : undefined);
    if (!candidateStatus) return undefined;
    const content = responses[candidateStatus]?.content || {};

    const tryTypes = (
      preferContentType ? [preferContentType] : []
    ).concat(["application/json", "text/json", "application/*+json"]);

    let contentType: string | undefined;
    for (const t of tryTypes) {
      if (t in content) { contentType = t; break; }
    }
    if (!contentType) contentType = Object.keys(content)[0];
    if (!contentType) return undefined;

    const schema = content[contentType]?.schema;
    return { schema, contentType, status: candidateStatus, operationId: resolved.operationId };
  }

  private getOrCompile (args: {
    operationId?: string;
    status: string;
    contentType: string;
    schema: any;
    openapiVersion: string;
  }): SerializerFn {
    const key = makeKey({ operationId: args.operationId, status: args.status, contentType: args.contentType });
    const cached = this.cache.get(key);
    if (cached) return cached;

    const normalized = normalizeForResponse(args.schema, { openapiVersion: args.openapiVersion });
    const bundled = bundleWithComponents(normalized, this.runtime.spec);

    const opts: StringifyOptions = this.options.fjs?.options || {};
    const compiled = fastJson(bundled, opts);
    this.cache.set(key, compiled);

    return compiled;
  }

  /** Optional: compile every (operationId, status, contentType) at startup */
  private async precompileAll () {
    const spec = this.runtime.spec;
    if (!spec) return;
    const version = (spec.openapi || "3.0").toString();

    for (const [_path, pathItem] of Object.entries<any>(spec.paths || {})) {
      for (const method of ["get", "put", "post", "delete", "patch", "options", "head", "trace"]) {
        const op = (pathItem as any)[method];
        if (!op) continue;
        const operationId: string | undefined = op.operationId;
        const responses = op.responses || {};

        for (const [status, resObj] of Object.entries<any>(responses)) {
          const content = resObj?.content || {};
          for (const [contentType, media] of Object.entries<any>(content)) {
            const schema = media?.schema;
            if (!schema) continue;
            const key = makeKey({ operationId, status, contentType });
            if (this.cache.has(key)) continue;

            const normalized = normalizeForResponse(schema, { openapiVersion: version });
            const bundled = bundleWithComponents(normalized, spec);

            const compiled = fastJson(bundled, this.options.fjs?.options || {});
            this.cache.set(key, compiled);
            this.debugLog(`Precompiled schema "${operationId}" response "${status}" "${contentType}"`);
          }
        }
      }
    }

    this.debugLog(`Precompiled ${this.cache.size} serializer(s).`);
  }
}
