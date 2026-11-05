# Advanced setup

## Extend the generated MCP server

Use `extendServer` when you want to register custom tools/resources/prompts in addition to OpenAPI-generated tools.

```ts
OpenAPIMcpModule.forRoot({
  specSource: { type: "object", spec: openApiSpec },
  executor: { baseUrl: "http://127.0.0.1:3000" },
  extendServer: (server) => {
    server.registerTool(
      "health_check",
      {
        title: "Health Check",
        description: "Returns MCP server health status",
        inputSchema: { type: "object", properties: {} } as any,
      },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
  },
});
```

This hook runs after OpenAPI-derived tools are registered.

## HTTP transport modes

When HTTP transport is enabled, `OpenAPIMcpModule` exposes an MCP endpoint (default `/mcp`) and delegates each request to `OpenAPIMcpService.handleHttp()`.

### Stateless mode (default)

```ts
http: {
  path: "/mcp",
  sessionMode: "stateless",
}
```

- A fresh MCP server/transport is created per request.
- Simpler operational model.

### Stateful mode

```ts
http: {
  path: "/mcp",
  sessionMode: "stateful",
  sessionTtlMs: 3600000,
}
```

- Server/transport instances are reused per `mcp-session-id`.
- Session id is returned in response headers.
- Sessions are cleaned automatically when TTL expires.

## Access control at the transport edge

Use host/origin allowlists to harden HTTP exposure:

```ts
http: {
  path: "/mcp",
  allowedHosts: ["trusted-host.com"],
  allowedOrigins: ["https://trusted.app"],
}
```

Denied requests return `403`.

## Upstream execution policy

Generated tools execute upstream HTTP operations via `executor.baseUrl`.

### Forward selected headers

```ts
executor: {
  baseUrl: "http://127.0.0.1:3000",
  forwardHeaders: ["authorization", "x-api-key"],
}
```

Only headers listed in `forwardHeaders` are propagated.

### Configure request timeout

```ts
executor: {
  baseUrl: "http://127.0.0.1:3000",
  timeoutMs: 15000,
}
```

Timeout is enforced per tool execution request.

## Tool exposure strategy (`x-mcp`)

OpenAPI operations are included based on this precedence:

1. `operation.x-mcp`
2. `pathItem.x-mcp`
3. `root.x-mcp`
4. `tools.defaultInclude`

This lets you define strict opt-in or broad include policies, then override at narrower scopes.

## Tool responses and output schemas

Successful tool calls return text `content` (preserving original payloads) and optional JSON `structuredContent`.

When all declared 2xx responses have JSON schemas, `outputSchema` is generated:

- **Single object response**: Returned directly in `structuredContent` (unwrapped).
- **Non-object responses** (arrays, primitives, nullables, unions): Wrapped as `{ result: payload }` to satisfy MCP's object schema requirement.
- **Multiple 2xx responses**: If an operation declares multiple distinct 2xx success schemas (e.g. `200` and `201`), they are combined with `anyOf` and wrapped as `{ result: payload }`. Identical schemas are deduplicated into a single unwrapped schema.
- **Empty body (`204`) / non-JSON**: If any success response lacks a JSON body, `outputSchema` is omitted so valid responses are not rejected by an incomplete contract.

To disable structured output mapping, set [`tools.mapOutputSchema`](options.md#tools) to `false`.
