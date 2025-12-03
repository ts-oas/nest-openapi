import type { ExecutionContext } from "@nestjs/common";
import type { SpecSource } from "@nest-openapi/runtime";

export type MockStrategy = "records" | "mediatype-examples" | "schema-examples" | "jsf" | "primitive" | "passthrough";

export interface OpenAPIMockOptions {
  /**
   * Source of the OpenAPI spec used to power the mock server.
   */
  specSource: SpecSource;

  /**
   * Master switch: registers the mock interceptor globally.
   *
   * - `false`: Mocking is completely disabled and the interceptor is NOT registered.
   *            Use when you don't want any mocking overhead in production.
   * - `true`: Interceptor is registered and may or may not mock requests based on configuration.
   *
   * @default true
   */
  enable?: boolean;

  /**
   * Controls default mocking behavior.
   *
   * - `true`: Mock all routes by default. Can be overridden by decorators.
   * - `false`: Do NOT mock by default (passthrough to real controllers). can be overridden by request hints or decorators.
   *
   * @default false
   */
  mockByDefault?: boolean;

  /**
   * Ordered list of strategies to attempt when generating a response.
   *
   * Supported values:
   * - "records" → use previously recorded responses from disk (requires recording.dir to be configured)
   * - "mediatype-examples" → use explicit OpenAPI examples from content[mediaType].examples
   * - "schema-examples" → use example/examples from the schema object itself (checks examples first, then example)
   * - "jsf" → synthesize JSON from the schema using json-schema-faker
   * - "primitive" → very simple deterministic values from schema types (e.g., string → "string", number → 0)
   * - "passthrough" → do not mock (useful in per-op overrides)
   *
   * If the array contains only example strategies and none are present,
   * the response will be a 501 (helpful for discovering spec gaps).
   *
   * @default ["mediatype-examples", "schema-examples", "jsf"] // prefer content examples, then schema examples, then synthesize
   */
  strategyOrder?: MockStrategy[];

  /**
   * Default HTTP status code to use when the plan does not specify one and
   * the request did not hint a status.
   *
   * If omitted, the system attempts to choose the first declared 2xx response
   * for the operation. You can force a specific status globally here or
   * per operation via `@Mock({ status })`.
   *
   * Default: `200`
   */
  defaultStatus?: number;

  /**
   * Seed to make synthesized JSON output deterministic.
   *
   * When provided, json-schema-faker uses a seeded RNG so that repeated calls
   * produce the same payload shape and values (useful for snapshots and CI).
   * Accepts a number or any string; strings are hashed into a numeric seed.
   */
  seed?: number | string;

  /**
   * Optional fixed or dynamic delay (milliseconds) applied before sending the mock response.
   * Useful to simulate network latency and client timeout handling.
   */
  delayMs?: number | ((ctx: ExecutionContext) => number);

  /**
   * Recording configuration for capturing and replaying real (non-mocked) responses.
   *
   * - `dir`: directory where recordings are stored/loaded
   * - `capture`: when `true`, saves real controller responses to disk (only when route is not mocked)
   * - `matchBody`: whether request body participates in the replay key matching
   * - `redact`: header names to redact from stored recordings
   */
  recording?: {
    dir: string;
    capture?: boolean;
    matchBody?: boolean;
    redact?: string[];
  };


  /**
   * json-schema-faker tuning for synthesized JSON responses.
   *
   * - `alwaysFakeOptionals`: include optional properties by default
   * - `useDefaultValue`: prefer schema `default` values when present
   * - `minItems`/`maxItems`: global array size bounds
   * - `formats`: map of custom format generators, e.g., `{ uuid: () => crypto.randomUUID() }`
   * - `extend`: hook to further configure the JSF instance (e.g., ignore properties)
   */
  jsf?: {
    alwaysFakeOptionals?: boolean;
    useDefaultValue?: boolean;
    minItems?: number;
    maxItems?: number;
    formats?: Record<string, () => any>;
    extend?: (jsf: any) => void;
  };

  /**
   * Enable verbose debug logging.
   *
   * Default: `false`
   */
  debug?: boolean;
}

export interface OperationMockOptions {
  /**
   * Explicitly enable or disable mocking for this specific route.
   * Overrides `mockByDefault` setting.
   */
  enable?: boolean;

  /**
   * Ordered list of strategies to attempt when generating a response.
   * Overrides `strategyOrder` global setting.
   */
  strategyOrder?: OpenAPIMockOptions['strategyOrder'];

  /**
   * Optional fixed or dynamic delay (milliseconds) applied before sending the mock response.
   * Overrides `delayMs` global setting.
   */
  delayMs?: OpenAPIMockOptions['delayMs'];

  /**
   * Force a particular HTTP status for the mocked response of this operation.
   * Overrides `defaultStatus`, but can be overridden by request hints (headers).
   */
  status?: number;

  /**
   * Force a specific media type (e.g., `application/json`). If omitted, the
   * first declared media type for the chosen response is used.
   */
  mediaType?: string;

  /**
   * Recording configuration override for this specific route.
   * Overrides global `recording` setting.
   */
  recording?: {
    capture?: boolean;
  };
}

export const OPENAPI_MOCK_OPTIONS = Symbol("OPENAPI_MOCK_OPTIONS");
export const OPENAPI_MOCK_RUNTIME = Symbol("OPENAPI_MOCK_RUNTIME");

