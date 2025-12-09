<p align="center">
  <img src="./docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="84" />
</p>

<h1 align="center">@nest-openapi</h1>

<p align="center"><strong>OpenAPI‑first utilities for NestJS</strong></p>

<p align="center">
  Single source of truth · Drop‑in for NestJS · Fast by design
</p>

<p align="center">
  <a href="https://deepwiki.com/ts-oas/nest-openapi">
    <img src="https://img.shields.io/badge/DeepWiki-ts--oas%2Fnest--openapi-blue.svg?color=teal&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppXPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==" alt="DeepWiki" />
  </a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" />
  </a>
</p>

---

## Features

- **🎯 Single Source of Truth** — Your OpenAPI spec drives validation, serialization, and mocking.
- **⚡ Fast by Design** — AJV validation and `fast-json-stringify` serialization with caching and precompilation.
- **🔌 Drop-in Integration** — Works with existing NestJS controllers and routes
- **🎛️ Fine-Grained Control** — Per-route opt-out and custom schema overrides
- **🚀 Platform Agnostic** — Supports both Express and Fastify adapters

## Packages

| Package                                                                              | Description                                                        | Version                                                                                                                     | Docs                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`@nest-openapi/validator`](https://www.npmjs.com/package/@nest-openapi/validator)   | Automatic request/response validation using your OpenAPI spec      | [![npm](https://img.shields.io/npm/v/@nest-openapi/validator.svg)](https://www.npmjs.com/package/@nest-openapi/validator)   | [📖 Docs](https://nest-openapi.github.io/validator/)  |
| [`@nest-openapi/serializer`](https://www.npmjs.com/package/@nest-openapi/serializer) | High-performance response serialization based on your OpenAPI spec | [![npm](https://img.shields.io/npm/v/@nest-openapi/serializer.svg)](https://www.npmjs.com/package/@nest-openapi/serializer) | [📖 Docs](https://nest-openapi.github.io/serializer/) |
| [`@nest-openapi/mock`](https://www.npmjs.com/package/@nest-openapi/mock)             | Spec-driven mock server for generating realistic mock responses    | [![npm](https://img.shields.io/npm/v/@nest-openapi/mock.svg)](https://www.npmjs.com/package/@nest-openapi/mock)             | [📖 Docs](https://nest-openapi.github.io/mock/)       |

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
    private readonly validator: OpenAPIValidatorService
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
- Supports Express and Fastify adopters

## Contributing

Issues and PRs are welcome. Please check the package folders and docs before opening an issue.

## License

MIT © [@nest-openapi](https://github.com/ts-oas/nest-openapi)
