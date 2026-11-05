<p align="center">
  <img src="https://raw.githubusercontent.com/ts-oas/nest-openapi/main/docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="80" />
</p>

<h1 align="center">@nest-openapi/runtime</h1>

<p align="center"><strong>Core OpenAPI runtime, spec loading, and platform utilities for the @nest-openapi suite</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-openapi/runtime"><img src="https://img.shields.io/npm/v/@nest-openapi/runtime.svg" alt="npm" /></a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" /></a>
  <a href="https://nest-openapi.github.io/"><img src="https://img.shields.io/badge/docs-nest--openapi-blue" alt="Documentation" /></a>
</p>

---

## Overview

`@nest-openapi/runtime` is the shared foundational library powering `@nest-openapi/validator`, `@nest-openapi/serializer`, `@nest-openapi/mock`, and `@nest-openapi/mcp`.

- **Spec-driven core** — Single source of truth spec loading from objects, files, and URLs.
- **Runtime pooling** — Centralized `OpenAPIRuntimePool` avoids redundant spec parsing across modules.
- **Platform-agnostic** — Uniform request data extraction across Express and Fastify via `PlatformUtil`.
- **Operation & Path resolution** — Bidirectional path mapping and operation resolution.

### Install

```bash
npm i @nest-openapi/runtime
```

### Key Utilities

#### `PlatformUtil`

Extract request data identically across Express and Fastify:

```typescript
import { PlatformUtil, type HttpArgumentsHost } from "@nest-openapi/runtime";

function handleRequest(ctx: HttpArgumentsHost) {
  const { method, path, body, params, query } =
    PlatformUtil.extractRequestData(ctx);
}
```

#### `OpenAPIRuntimeService`

Load and access parsed OpenAPI specifications:

```typescript
import { OpenAPIRuntimeService } from "@nest-openapi/runtime";

const runtime = new OpenAPIRuntimeService({
  specSource: { type: "file", path: "./openapi.json" },
});

await runtime.init();
const spec = runtime.spec;
```


## Next Steps

- [Validator](https://nest-openapi.github.io/validator/) — Spec-driven request and response validation
- [Serializer](https://nest-openapi.github.io/serializer/) — High-performance response serialization
- [Mock](https://nest-openapi.github.io/mock/) — Spec-driven mock server utilities
- [MCP](https://nest-openapi.github.io/mcp/) — Exposing OpenAPI operations as MCP tools
