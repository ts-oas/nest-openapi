import type { SpecSource } from "@nest-openapi/runtime";
import type { Options as StringifyOptions } from "fast-json-stringify";

export interface SerializerOptions {
  /** Source of the OpenAPI spec. */
  specSource: SpecSource;

  /** Precompile all response schemas on bootstrap (removes first‑hit latency). @default false */
  precompileSchemas?: boolean;

  /** Verbose logs for troubleshooting. @default false */
  debug?: boolean;

  /**
   * fast-json-stringify configuration hook; allows users to tweak
   * generated serializers (e.g., rounding, custom stringifiers, ajv ref resolver).
   */
  fjs?: {
    /** Pass-through options to fast-json-stringify's compile() */
    options?: StringifyOptions;
  };

  /** Serialization options */
  responseSerialization?: {
    /**
     * Enable response serialization globally. @default true
     */
    enable?: boolean;
    /**
     * Skip serializing error responses (4xx/5xx). @default true
     */
    skipErrorResponses?: boolean;
    /**
     * Called when serialization throws;
     * You can:
     * - Transform errors and throw a custom exception
     * - Log and ignore errors (return without throwing)
     *
     * If not provided, warns and throws `InternalServerErrorException`
     */
    onSerializationFailed?: (args: {
      context: import("@nestjs/common").ExecutionContext;
      operationId?: string;
      statusCode: number;
      error: unknown;
    }) => void | never;
  };
}

export const OPENAPI_SERIALIZER_RUNTIME = Symbol("OPENAPI_SERIALIZER_RUNTIME");
export const OPENAPI_SERIALIZER_OPTIONS = Symbol("OPENAPI_SERIALIZER_OPTIONS");
