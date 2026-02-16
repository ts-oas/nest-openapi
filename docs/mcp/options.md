# Options

## Configuration Options

| Option                      | Type                                                                                                       | Default                | Description                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| [`specSource`](#specsource) | `{ type: "object"; spec: OpenAPISpec } \| { type: "url"; spec: string } \| { type: "file"; spec: string }` | —                      | Provide your OpenAPI 3.x spec as an object, or point to it via URL or file path.    |
| [`server`](#server)         | `{ name?: string; version?: string }`                                                                      | see [below](#server)   | MCP server metadata exposed during initialize.                                      |
| [`tools`](#tools)           | `OpenAPIMcpToolsOptions`                                                                                   | see [below](#tools)    | Control tool inclusion and naming.                                                  |
| [`http`](#http)             | `OpenAPIMcpHttpOptions`                                                                                    | see [below](#http)     | Configure built-in MCP HTTP endpoint behavior.                                      |
| [`executor`](#executor)     | `OpenAPIMcpExecutorOptions`                                                                                | see [below](#executor) | Configure how generated tools execute target HTTP operations.                       |
| `extendServer`              | `(server: McpServer) => void \| Promise<void>`                                                             | —                      | Hook to register custom tools/resources/prompts or modify the generated MCP server. |
| `debug`                     | `boolean`                                                                                                  | `false`                | Verbose logs for troubleshooting.                                                   |

### `specSource`

| Type       | Type          | Typical use                                      |
| ---------- | ------------- | ------------------------------------------------ |
| `"object"` | `OpenAPISpec` | Static spec object.                              |
| `"url"`    | `string`      | Link to a centralized or externally hosted spec. |
| `"file"`   | `string`      | Local file path to a json/yaml file.             |

### `server`

| Option    | Type     | Default                            | Description                                |
| --------- | -------- | ---------------------------------- | ------------------------------------------ |
| `name`    | `string` | `spec.info.title` or `openapi-mcp` | MCP server display name during initialize. |
| `version` | `string` | `spec.info.version` or `0.0.0`     | MCP server version during initialize.      |

### `tools`

| Option           | Type      | Default | Description                                                         |
| ---------------- | --------- | ------- | ------------------------------------------------------------------- |
| `defaultInclude` | `boolean` | `false` | Include operations as tools by default when `x-mcp` is not defined. |
| `namePrefix`     | `string`  | —       | Optional prefix for generated tool names (e.g. `api_`).             |

`x-mcp` precedence for operation inclusion is:

1. operation-level `x-mcp`
2. path-level `x-mcp`
3. root-level `x-mcp`
4. fallback to `tools.defaultInclude`

### `http`

| Option           | Type                        | Default       | Description                                                                  |
| ---------------- | --------------------------- | ------------- | ---------------------------------------------------------------------------- |
| `enabled`        | `boolean`                   | `true`        | Enable built-in MCP HTTP endpoint/controller.                                |
| `path`           | `string`                    | `"/mcp"`      | Endpoint path for streamable HTTP MCP transport.                             |
| `sessionMode`    | `"stateless" \| "stateful"` | `"stateless"` | Transport lifecycle mode for HTTP requests.                                  |
| `sessionTtlMs`   | `number`                    | `3600000`     | Session TTL in stateful mode. Expired sessions are cleaned up automatically. |
| `allowedOrigins` | `string[]`                  | —             | Optional origin allowlist check (returns `403` when denied).                 |
| `allowedHosts`   | `string[]`                  | —             | Optional host allowlist check (returns `403` when denied).                   |

### `executor`

| Option           | Type       | Default             | Description                                                            |
| ---------------- | ---------- | ------------------- | ---------------------------------------------------------------------- |
| `baseUrl`        | `string`   | —                   | Base URL for upstream HTTP execution. Required.                        |
| `forwardHeaders` | `string[]` | `["authorization"]` | Request headers to forward from MCP request context to upstream calls. |
| `timeoutMs`      | `number`   | `30000`             | Upstream HTTP timeout per tool call.                                   |

## Async Configuration

Use `forRootAsync()` for dependency injection:

```ts
OpenAPIMcpModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    specSource: { type: "url", spec: config.getOrThrow("OPENAPI_SPEC_URL") },
    http: {
      path: "/mcp",
      sessionMode: "stateless",
    },
    executor: {
      baseUrl: config.getOrThrow("TARGET_API_BASE_URL"),
      forwardHeaders: ["authorization", "x-api-key"],
      timeoutMs: 15000,
    },
  }),
  inject: [ConfigService],
});
```
