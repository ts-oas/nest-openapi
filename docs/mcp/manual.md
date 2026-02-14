# Manual Usage

Inject the `OpenAPIMcpService` for programmatic MCP server usage (e.g., dedicated stdio process, custom transport handling, or advanced lifecycle control).

## Inject the service

```ts
import { Inject, Injectable } from "@nestjs/common";
import { OpenAPIMcpService, OPENAPI_MCP } from "@nest-openapi/mcp";

@Injectable()
export class McpRunnerService {
  constructor(@Inject(OPENAPI_MCP) private readonly mcp: OpenAPIMcpService) {}
}
```

## Start stdio transport manually

Use this for CLI agents or sidecar MCP processes:

```ts
await this.mcp.startStdio();
```

This creates the MCP server from your OpenAPI spec and connects it to stdio transport.

## Create and extend server programmatically

You can create a fully configured MCP server instance and manage transport yourself:

```ts
const server = await this.mcp.createServer();
// connect your own transport here
```

For non-manual patterns such as `extendServer`, HTTP session strategy, and header-forwarding policy, see [Advanced setup](./advanced-setup.md).
