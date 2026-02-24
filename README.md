<p align="center">
  <img src="./docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="84" />
</p>

<h1 align="center">@nest-openapi</h1>

<p align="center"><strong>OpenAPI‑first utilities for NestJS</strong></p>

<p align="center">
  Single source of truth · Drop‑in for NestJS · Fast by design
</p>

<p align="center">
  <a href="https://deepwiki.com/ts-oas/nest-openapi"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" />
  </a>
</p>

---

## Features

- **🎯 Single Source of Truth** — Your OpenAPI spec drives validation, serialization, mocking, and MCP tools.
- **⚡ Fast by Design** — AJV validation and `fast-json-stringify` serialization with caching and precompilation.
- **🔌 Drop-in Integration** — Works with existing NestJS controllers and routes
- **🎛️ Fine-Grained Control** — Per-route opt-out and custom schema overrides
- **🚀 Platform Agnostic** — Supports both Express and Fastify adapters

## Packages

| Package                                                                  | Description                                                        | Version                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [`@nest-openapi/validator`](https://nest-openapi.github.io/validator/)   | Automatic request/response validation using your OpenAPI spec      | [![npm](https://img.shields.io/npm/v/@nest-openapi/validator.svg)](https://www.npmjs.com/package/@nest-openapi/validator)   |
| [`@nest-openapi/serializer`](https://nest-openapi.github.io/serializer/) | High-performance response serialization based on your OpenAPI spec | [![npm](https://img.shields.io/npm/v/@nest-openapi/serializer.svg)](https://www.npmjs.com/package/@nest-openapi/serializer) |
| [`@nest-openapi/mock`](https://nest-openapi.github.io/mock/)             | Spec-driven mock server for generating realistic mock responses    | [![npm](https://img.shields.io/npm/v/@nest-openapi/mock.svg)](https://www.npmjs.com/package/@nest-openapi/mock)             |
| [`@nest-openapi/mcp`](https://nest-openapi.github.io/mcp/)               | Spec-driven MCP server for exposing OpenAPI operations as tools    | [![npm](https://img.shields.io/npm/v/@nest-openapi/mcp.svg)](https://www.npmjs.com/package/@nest-openapi/mcp)               |

## Quick Start

### Validator

```bash
npm i @nest-openapi/validator
```

```typescript
import { Module } from "@nestjs/common";
import { OpenAPIValidatorModule } from "@nest-openapi/validator";
import * as openApiSpec from "./openapi.json";

@Module({
  imports: [
    OpenAPIValidatorModule.forRoot({
      specSource: { type: "object", spec: openApiSpec },
    }),
  ],
})
export class AppModule {}
```

**All routes are automatically validated.** See [full documentation](https://nest-openapi.github.io/validator/) for advanced configuration.

### Serializer

```bash
npm i @nest-openapi/serializer
```

```typescript
import { Module } from "@nestjs/common";
import { OpenAPISerializerModule } from "@nest-openapi/serializer";
import * as openApiSpec from "./openapi.json";

@Module({
  imports: [
    OpenAPISerializerModule.forRoot({
      specSource: { type: "object", spec: openApiSpec },
      responseSerialization: { enable: true, skipErrorResponses: true },
    }),
  ],
})
export class AppModule {}
```

**Responses are automatically serialized.** See [full documentation](https://nest-openapi.github.io/serializer/) for advanced configuration.

### Mock

```bash
npm i @nest-openapi/mock
```

```typescript
import { Module } from "@nestjs/common";
import { OpenAPIMockModule } from "@nest-openapi/mock";
import * as openApiSpec from "./openapi.json";

@Module({
  imports: [
    OpenAPIMockModule.forRoot({
      specSource: { type: "object", spec: openApiSpec },
      enable: process.env.NODE_ENV === "development",
      mockByDefault: true,
    }),
  ],
})
export class AppModule {}
```

**Routes return mocked responses when enabled.** See [full documentation](https://nest-openapi.github.io/mock/) for advanced configuration.

### MCP

```bash
npm i @nest-openapi/mcp
```

```typescript
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

**Expose OpenAPI operations as MCP tools.** See [full documentation](https://nest-openapi.github.io/mcp/) for advanced configuration.

## Usage Examples

### Manual Validation

```typescript
import { Inject, Injectable } from "@nestjs/common";
import {
  OPENAPI_VALIDATOR,
  OpenAPIValidatorService,
} from "@nest-openapi/validator";

@Injectable()
export class MyService {
  constructor(
    @Inject(OPENAPI_VALIDATOR)
    private readonly validator: OpenAPIValidatorService,
  ) {}

  validate(ctx: HttpArgumentsHost) {
    const errors = this.validator.validateRequest(ctx, { body: true });
    if (errors.length > 0) {
      // Handle validation errors
    }
  }
}
```

### Per-Route Overrides

```typescript
import { Controller, Post } from "@nestjs/common";
import { Validate } from "@nest-openapi/validator";
import { Serialize } from "@nest-openapi/serializer";

@Controller("books")
export class BooksController {
  @Post()
  @Validate({ request: { query: false }, response: true })
  @Serialize({ disable: true })
  create(@Body() dto: CreateBookDto): Book {
    return this.booksService.create(dto);
  }
}
```

## Compatibility

- Works with NestJS v9+
- Supports Express and Fastify adapters

## Contributing

Issues and PRs are welcome. Please check the package folders and docs before opening an issue.

## License

MIT © [@nest-openapi](https://github.com/ts-oas/nest-openapi)
