import { ExecutionContext, Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DebugUtil, OpenAPIRuntimeService, PlatformUtil } from "@nest-openapi/runtime";
import { normalizeForResponseLocal, bundleWithComponentsLocal } from "../utils/oas.util";
import { OPENAPI_MOCK_OPTIONS, OPENAPI_MOCK_RUNTIME, OperationMockOptions, OpenAPIMockOptions, MockStrategy } from "../types/mock-options.interface";
import { RecordingStoreService } from "./recording-store.service";

export const OPENAPI_MOCK = Symbol("OPENAPI_MOCK");

type Plan = OperationMockOptions & { operationKey?: string };

@Injectable()
export class OpenAPIMockService implements OnModuleInit {
  private readonly logger = new Logger("OpenAPIMock");
  private debugLog: (message: string, ...args: any[]) => void;
  private jsfInstance: any;
  private jsfConfigured = false;

  constructor(
    @Inject(OPENAPI_MOCK_OPTIONS) public readonly options: OpenAPIMockOptions,
    @Inject(OPENAPI_MOCK_RUNTIME) private readonly runtime: OpenAPIRuntimeService,
    @Inject(RecordingStoreService) public readonly recording: RecordingStoreService,
  ) {
    this.debugLog = DebugUtil.createDebugFn(this.logger, this.options.debug || false);
  }

  async onModuleInit() {
    // Pre-load and configure JSF if strategies include it
    const strategies = this.options.strategyOrder || [];

    if (strategies.includes("jsf")) {
      await this.initializeJSF();
    }

    if (strategies.includes("records") && !this.options.recording?.dir) {
      this.logger.warn('Strategy "records" is in strategyOrder but recording.dir is not configured in options. ');
    }
  }

  private async initializeJSF() {
    if (this.jsfConfigured) return;

    try {
      this.jsfInstance = await import("json-schema-faker").then((m) => m.default || m);

      // Configure JSF options once
      this.jsfInstance.option({
        alwaysFakeOptionals: this.options.jsf?.alwaysFakeOptionals ?? false,
        useDefaultValue: this.options.jsf?.useDefaultValue ?? true,
        minItems: this.options.jsf?.minItems ?? 1,
        maxItems: this.options.jsf?.maxItems ?? 10,
      });

      // Apply seed if configured
      if (this.options.seed !== undefined) {
        this.jsfInstance.option({ random: this.seededRandom(this.options.seed) });
      }

      // Apply custom formats if configured
      if (this.options.jsf?.formats) {
        for (const [fmt, fn] of Object.entries(this.options.jsf.formats)) {
          this.jsfInstance.format(fmt, fn as any);
        }
      }

      // Apply custom extension if configured
      if (this.options.jsf?.extend) {
        this.options.jsf.extend(this.jsfInstance);
      }

      this.jsfConfigured = true;
      this.debugLog("JSF initialized and configured");
    } catch (error: any) {
      this.logger.error(`Failed to initialize JSF: ${error?.message || error}`);
    }
  }

  isEnabled(): boolean {
    return !!this.options.enable;
  }

  getOperationKey(ctx: ExecutionContext): string | undefined {
    const op = this.runtime.operationResolver.resolve(ctx);
    if (!op) return undefined;
    return `${op.method.toUpperCase()} ${op.pathTemplate}`;
  }

  tryPlan(ctx: ExecutionContext, override?: OperationMockOptions): Plan | undefined {
    // Check if interceptor is globally enabled
    if (!this.isEnabled()) return undefined;

    const op = this.runtime.operationResolver.resolve(ctx);
    if (!op) return undefined;

    const req = ctx.switchToHttp().getRequest();

    // Determine if we should mock this request
    // Priority: header > decorator > global mockByDefault
    const headerEnable = PlatformUtil.getHeader(req, "x-mock-enable");
    const decoratorEnable = override?.enable;

    const headerEnableValue =
      typeof headerEnable === "string" ? headerEnable.toLowerCase() === "true" : undefined;

    const shouldMock =
      headerEnableValue !== undefined
        ? headerEnableValue
        : decoratorEnable === true
        ? true
        : decoratorEnable === false
        ? false
        : this.options.mockByDefault ?? false;

    if (!shouldMock) return undefined;

    const headerStatus = PlatformUtil.getHeader(req, "x-mock-status");
    const headerMedia = PlatformUtil.getHeader(req, "x-mock-media");
    const headerStrategyOrder = PlatformUtil.getHeader(req, "x-mock-strategy-order");

    const headerStrategyOrderValue = headerStrategyOrder
      ? headerStrategyOrder.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : undefined;

    const operationKey = `${op.method.toUpperCase()} ${op.pathTemplate}`;

    const plan: Plan = {
      ...this.options,
      ...override,
      status: Number(headerStatus) || (override as OperationMockOptions)?.status || this.options.defaultStatus || 200,
      mediaType: (headerMedia as any) || (override as OperationMockOptions)?.mediaType,
      strategyOrder: headerStrategyOrderValue || (override as OperationMockOptions)?.strategyOrder || this.options.strategyOrder,
      operationKey,
    };

    return plan;
  }

  async generate(ctx: ExecutionContext, plan: Plan): Promise<{ status: number; headers?: Record<string, string>; body: any; mediaType?: string } | undefined> {
    const op = this.runtime.operationResolver.resolve(ctx);
    if (!op) return undefined;

    const { status, mediaType } = this.pickVariant(op, plan);
    const mt = mediaType || this.pickFirstMediaType(op, status) || "application/json";
    const operationKey = `${op.method.toUpperCase()} ${op.pathTemplate}`;

    const order = this.getStrategyOrder(plan);

    // Try records strategy if it's in the order and is the first strategy
    if (order.includes("records") && order[0] === "records") {
      const replay = await this.recording.load(ctx, { operationKey, status, mediaType: mt });
      if (replay) return replay;
    }

    const body = await this.generateBody(ctx, op, status, mt, plan, order);
    if (body === undefined && this.isExamplesOnly(order)) {
      return { status: 501, headers: { "content-type": "application/json" }, body: { error: "No example for mocked route" }, mediaType: "application/json" };
    }

    // If passthrough was used, return undefined to call real controller
    if (body === undefined) return undefined;

    const result = { status, headers: { "content-type": mt }, body: body ?? null, mediaType: mt } as const;

    return result;
  }

  private pickVariant(op: any, plan: Plan): { status: number; mediaType?: string } {
    const responses = op.responses || {};
    const availableStatuses = Object.keys(responses).filter((s) => s !== 'default' && /^\d{3}$/.test(s));

    // If a specific status is requested, use it if available
    if (plan.status && availableStatuses.includes(String(plan.status))) {
      return { status: plan.status, mediaType: plan.mediaType };
    }

    // Otherwise, prefer 2xx statuses
    const successStatuses = availableStatuses.filter((s) => /^2\d\d$/.test(s));
    const chosen = Number(successStatuses[0] || availableStatuses[0] || this.options.defaultStatus || 200);
    return { status: chosen, mediaType: plan.mediaType };
  }

  private pickFirstMediaType(op: any, status: number): string | undefined {
    const res = op.responses?.[String(status)] || op.responses?.default;
    const content = res?.content || {};
    return Object.keys(content)[0];
  }

  private async generateBody(ctx: ExecutionContext, op: any, status: number, mediaType: string, plan: Plan, order: MockStrategy[]): Promise<any> {
    const res = op.responses?.[String(status)] || op.responses?.default;
    const content = res?.content || {};
    const mt = content[mediaType] || content["application/json"] || Object.values(content)[0];

    // Check for passthrough strategy
    if (order.includes("passthrough")) return undefined;

    // Try strategies in order
    for (const strategy of order) {
      if (strategy === "passthrough") continue; // Already handled above

      // Records strategy (only if not already checked as first strategy)
      if (strategy === "records") {
        if (order[0] !== "records") {
          // Records was not first, check it now
          const operationKey = `${op.method.toUpperCase()} ${op.pathTemplate}`;
          const replay = await this.recording.load(ctx, { operationKey, status, mediaType });
          if (replay) return replay.body;
        }
        continue; // Already checked or not found, continue to next strategy
      }

      // Mediatype-examples strategy
      if (strategy === "mediatype-examples") {
        if (mt?.examples) {
          const firstNamed = Object.values(mt.examples)[0] as any;
          if (firstNamed?.value !== undefined) return firstNamed.value;
        }
        continue;
      }

      // Schema-examples and other strategies are handled in field-by-field generation
      // Break here to proceed with field-by-field generation
      break;
    }

    // For JSON media types, use field-by-field generation with remaining strategies
    if (mediaType.startsWith("application/json") && mt?.schema) {
      const resolvedSchema = this.resolveSchemaForExamples(mt.schema);
      if (resolvedSchema) {
        return await this.generateFieldByField(resolvedSchema, order, op.openapiVersion);
      }
    }

    // Simple defaults for non‑JSON when strategies did not yield
    if (mediaType.startsWith("text/")) return "mock";
    if (mediaType === "application/octet-stream") return Buffer.from("mock");

    return undefined;
  }

  /**
   * Generate a value for a single field by trying strategies in order, with example tracking.
   * Returns both the value and whether an example was used.
   */
  private async generateFieldValueWithExampleTracking(schema: any, order: MockStrategy[], openapiVersion: string): Promise<{ value: any; usedExample: boolean }> {
    if (!schema || typeof schema !== "object") return { value: undefined, usedExample: false };

    // Resolve $ref if present
    if (schema.$ref) {
      const resolved = this.runtime.schemaResolver.resolveSchema(schema);
      if (resolved) return await this.generateFieldValueWithExampleTracking(resolved, order, openapiVersion);
      return { value: undefined, usedExample: false };
    }

    // Try each strategy in order
    for (const strategy of order) {
      if (strategy === "passthrough") continue; // Skip passthrough at field level
      if (strategy === "mediatype-examples") continue; // Already handled at top level

      if (strategy === "schema-examples") {
        // Check for examples array or example property
        if (Array.isArray(schema.examples) && schema.examples.length > 0) {
          return { value: schema.examples[0], usedExample: true };
        }
        if (schema.example !== undefined) {
          return { value: schema.example, usedExample: true };
        }
        continue;
      }

      if (strategy === "jsf") {
        try {
          // Ensure JSF is initialized
          if (!this.jsfConfigured) {
            await this.initializeJSF();
          }

          if (!this.jsfInstance) {
            continue; // JSF not available, try next strategy
          }

          // Reset seed for deterministic generation if configured
          if (this.options.seed !== undefined) {
            this.jsfInstance.option({ random: this.seededRandom(this.options.seed) });
          }

          const normalized = normalizeForResponseLocal(schema, openapiVersion);
          const bundled = bundleWithComponentsLocal(normalized, this.runtime.spec);
          const generated = this.jsfInstance.generate(bundled);

          // JSF might return undefined or null, treat as failure
          if (generated !== undefined && generated !== null) {
            return { value: generated, usedExample: false };
          }
        } catch (error: any) {
          // JSF failed, try next strategy
          this.debugLog(`JSF generation failed for field: ${error?.message || error}`);
          continue;
        }
        continue;
      }

      if (strategy === "primitive") {
        const primitive = this.generatePrimitive(schema);
        if (primitive !== null && primitive !== undefined) {
          return { value: primitive, usedExample: false };
        }
        continue;
      }
    }

    // All strategies failed
    return { value: undefined, usedExample: false };
  }

  /**
   * Generate a value field-by-field, applying strategies per field with fallback.
   * Recursively handles objects, arrays, and primitives.
   * Returns undefined if examples-only strategies are used and no examples were found.
   */
  private async generateFieldByField(schema: any, order: MockStrategy[], openapiVersion: string): Promise<any> {
    if (!schema || typeof schema !== "object") return undefined;

    const isExamplesOnly = this.isExamplesOnly(order);

    // Resolve $ref if present
    if (schema.$ref) {
      const resolved = this.runtime.schemaResolver.resolveSchema(schema);
      if (resolved) return await this.generateFieldByField(resolved, order, openapiVersion);
      return undefined;
    }

    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

    // Handle object schemas
    if (type === "object" || (!type && schema.properties)) {
      // Check for object-level examples first (complete examples take precedence)
      if (order.includes("schema-examples")) {
        if (Array.isArray(schema.examples) && schema.examples.length > 0) {
          return schema.examples[0];
        }
        if (schema.example !== undefined) {
          return schema.example;
        }
      }

      // No object-level examples, generate field-by-field
      const props = schema.properties || {};
      const required = Array.isArray(schema.required) ? schema.required : [];
      const obj: Record<string, any> = {};
      let foundAnyExample = false;

      for (const key of Object.keys(props)) {
        const prop = props[key];
        if (prop && prop.writeOnly) continue; // Skip writeOnly properties

        const isRequired = required.includes(key);
        const propType = Array.isArray(prop.type) ? prop.type[0] : prop.type;

        // For nested objects and arrays, use recursive field-by-field generation
        // For primitives, use generateFieldValue
        let value: any;
        let usedExample = false;
        if (propType === "object" || (!propType && prop.properties)) {
          // Check if nested object has object-level examples (they take precedence)
          const hasObjectExample = order.includes("schema-examples") &&
            ((Array.isArray(prop.examples) && prop.examples.length > 0) || prop.example !== undefined);

          value = await this.generateFieldByField(prop, order, openapiVersion);

          // If object-level example exists and value matches it, example was used
          if (hasObjectExample && value !== undefined) {
            usedExample = true;
          } else if (value !== undefined && isExamplesOnly) {
            // For examples-only, if value exists, it must have used examples (otherwise would be undefined)
            usedExample = true;
          }
        } else if (propType === "array") {
          value = await this.generateFieldByField(prop, order, openapiVersion);
          if (value !== undefined && isExamplesOnly) {
            usedExample = true;
          }
        } else {
          const result = await this.generateFieldValueWithExampleTracking(prop, order, openapiVersion);
          value = result.value;
          usedExample = result.usedExample;
        }

        if (usedExample) {
          foundAnyExample = true;
        }

        // Include field if value was generated, or if it's required (will use primitive fallback)
        if (value !== undefined || isRequired) {
          obj[key] = value !== undefined ? value : this.generatePrimitive(prop);
        }
      }

      // If examples-only and no examples were found, return undefined
      if (isExamplesOnly && !foundAnyExample) {
        return undefined;
      }

      return obj;
    }

    // Handle array schemas
    if (type === "array") {
      // Check for array-level examples first (complete array examples take precedence)
      if (order.includes("schema-examples")) {
        if (Array.isArray(schema.examples) && schema.examples.length > 0) {
          return schema.examples[0];
        }
        if (schema.example !== undefined) {
          return schema.example;
        }
      }

      // No array-level examples, generate item-by-item
      const itemSchema = schema.items || {};
      const value = await this.generateFieldByField(itemSchema, order, openapiVersion);
      // If field-by-field generation fails and we're examples-only, return undefined
      if (value === undefined && isExamplesOnly) {
        return undefined;
      }
      // If field-by-field generation fails, try primitive for array items
      if (value === undefined) {
        const primitiveValue = this.generatePrimitive(itemSchema);
        return primitiveValue !== null ? [primitiveValue] : [];
      }
      return [value];
    }

    // Handle primitive types
    const result = await this.generateFieldValueWithExampleTracking(schema, order, openapiVersion);
    // If examples-only and no example was used, return undefined
    if (isExamplesOnly && !result.usedExample && result.value === undefined) {
      return undefined;
    }
    return result.value;
  }

  private getStrategyOrder(plan: Plan): MockStrategy[] {
    if (plan.strategyOrder && Array.isArray(plan.strategyOrder) && plan.strategyOrder.length) {
      return plan.strategyOrder;
    }

    // Default order when not specified explicitly
    return ["mediatype-examples", "schema-examples", "jsf"];
  }

  private isExamplesOnly(order: MockStrategy[]): boolean {
    // Check if order contains only example strategies (no jsf, primitive, passthrough, or records)
    const exampleStrategies: MockStrategy[] = ["mediatype-examples", "schema-examples"];
    return order.every(s => exampleStrategies.includes(s));
  }

  /**
   * Resolve schema for example extraction, handling $ref references
   */
  private resolveSchemaForExamples(schema: any): any {
    if (!schema) return null;

    // Resolve $ref if present
    if (schema.$ref) {
      const resolved = this.runtime.schemaResolver.resolveSchema(schema);
      if (resolved) return resolved;
      return null;
    }

    return schema;
  }

  private generatePrimitive(schema: any): any {
    if (!schema || typeof schema !== "object") return null;

    // Resolve $ref if present
    if (schema.$ref) {
      const resolved = this.runtime.schemaResolver.resolveSchema(schema);
      if (resolved) return this.generatePrimitive(resolved);
    }

    if (schema.const !== undefined) return schema.const;
    if (schema.enum && Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    switch (type) {
      case "string":
        if (schema.format === "date-time") return new Date(0).toISOString();
        if (schema.format === "date") return "1970-01-01";
        if (schema.format === "uuid") return "00000000-0000-0000-0000-000000000000";
        return "string";
      case "number":
      case "integer":
        return 0;
      case "boolean":
        return false;
      case "null":
        return null;
      case "array": {
        const itemSchema = schema.items || {};
        return [this.generatePrimitive(itemSchema)];
      }
      case "object":
      default: {
        const obj: Record<string, any> = {};
        const props = schema.properties || {};
        for (const key of Object.keys(props)) {
          const prop = props[key];
          if (prop && prop.writeOnly) continue; // mimic response stance
          obj[key] = this.generatePrimitive(prop);
        }
        // if no properties, return empty object for object type
        return obj;
      }
    }
  }

  private seededRandom(seed: number | string) {
    let s = typeof seed === "string" ? this.hash(seed) : Number(seed) || 1;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  private hash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
    return Math.abs(h) + 1;
  }
}

