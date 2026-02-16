# Overview

`@nest-openapi/mcp` turns your OpenAPI 3.x operations into MCP tools for NestJS applications.

- **Spec-driven** — Tools are generated from OpenAPI operations.
- **API contract ↔ MCP contract** — Request/input and success response/output OpenAPI schemas are mapped into MCP tool schemas.
- **Secure by default** — Tool exposure is opt-in by default (`x-mcp: true` per operation).
- **NestJS-native** — HTTP transport integration plus programmatic server APIs.

### Install

```bash
npm i @nest-openapi/mcp
```

### Quick Start

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { OpenAPIMcpModule } from "@nest-openapi/mcp";
import * as openApiSpec from "./openapi.json";

@Module({
  imports: [
    OpenAPIMcpModule.forRoot({
      specSource: { type: "object", spec: openApiSpec },
      http: { path: "/mcp" },
      executor: { baseUrl: "http://127.0.0.1:3000" },
    }),
  ],
})
export class AppModule {}
```

That’s it. Your MCP endpoint is available at `/mcp`.

### Tool Exposure with `x-mcp`

By default, only operations explicitly marked with `x-mcp: true` are exposed as tools.

```yaml
paths:
  /users/{id}:
    get:
      operationId: getUser
      x-mcp: true
```

You can change this behavior using [`tools.defaultInclude`](/mcp/options#tools).

## Next Steps

- [Advanced setup](./advanced-setup.md) — Transport/session strategy and server extension patterns
- [Options](./options.md) — Full configuration reference
- [Manual Usage](./manual.md) — Programmatic MCP server usage
