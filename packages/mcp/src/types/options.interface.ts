import type { SpecSource } from '@nest-openapi/runtime';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface OpenAPIMcpToolsOptions {
  /**
   * Include operations as tools by default when `x-mcp` is not defined.
   * @default false
   */
  defaultInclude?: boolean;
  /**
   * Optional prefix for generated tool names.
   *
   * @example "api_"
   */
  namePrefix?: string;
}

export interface OpenAPIMcpHttpOptions {
  /**
   * Enable built-in MCP HTTP endpoint/controller.
   * @default true
   */
  enabled?: boolean;
  /**
   * Endpoint path for streamable HTTP MCP transport.
   * @default "/mcp"
   */
  path?: string;
  /**
   * HTTP transport lifecycle mode.
   * @default "stateless"
   */
  sessionMode?: 'stateless' | 'stateful';
  /**
   * Session TTL in stateful mode. Expired sessions are cleaned up automatically.
   * @default 3600000
   */
  sessionTtlMs?: number;
  /**
   * Optional origin allowlist check. Requests from non-listed origins are rejected with `403`.
   */
  allowedOrigins?: string[];
  /**
   * Optional host allowlist check. Requests from non-listed hosts are rejected with `403`.
   */
  allowedHosts?: string[];
}

export interface OpenAPIMcpExecutorOptions {
  /**
   * Base URL for upstream HTTP execution.
   * Required.
   */
  baseUrl: string;
  /**
   * Request headers to forward from MCP request context to upstream calls.
   * @default ["authorization"]
   */
  forwardHeaders?: string[];
  /**
   * Upstream HTTP timeout per tool call, in milliseconds.
   * @default 30000
   */
  timeoutMs?: number;
}

export interface OpenAPIMcpOptions {
  /**
   * Provide your OpenAPI spec as an object, or point to it via URL or file path.
   *
   * Examples:
   * ```
   *   { type: "object", spec: {...} }
   *   { type: "url",    spec: "https://…" }
   *   { type: "file",   spec: "./openapi.json" }
   * ```
   */
  specSource: SpecSource;

  /**
   * MCP server metadata exposed during initialize.
   * Defaults:
   * - `name`: `spec.info.title` or `openapi-mcp`
   * - `version`: `spec.info.version` or `0.0.0`
   */
  server?: {
    name?: string;
    version?: string;
  };

  /**
   * Controls tool inclusion and naming.
   */
  tools?: OpenAPIMcpToolsOptions;

  /**
   * Configures built-in HTTP transport.
   */
  http?: OpenAPIMcpHttpOptions;

  /**
   * Configures upstream execution policy.
   */
  executor: OpenAPIMcpExecutorOptions;

  /**
   * Hook for registering custom tools/resources/prompts or further modifying the generated MCP server.
   */
  extendServer?: (server: McpServer) => void | Promise<void>;

  /**
   * Verbose logs for troubleshooting.
   * @default false
   */
  debug?: boolean;
}
