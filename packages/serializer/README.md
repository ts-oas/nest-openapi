<p align="center">
  <img src="https://raw.githubusercontent.com/ts-oas/nest-openapi/main/docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="80" />
</p>

<h1 align="center">@nest-openapi/serializer</h1>

<p align="center"><strong>High-performance response serialization for NestJS based on your OpenAPI spec</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-openapi/serializer"><img src="https://img.shields.io/npm/v/@nest-openapi/serializer.svg" alt="npm" /></a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" /></a>
  <a href="https://nest-openapi.github.io/serializer/"><img src="https://img.shields.io/badge/docs-nest--openapi-blue" alt="Documentation" /></a>
</p>

---

## Overview

`@nest-openapi/serializer` provides high‑performance response serialization based on your OpenAPI 3.x spec.

- **Spec‑driven** — The OpenAPI spec is the contract; serializers are generated from it.
- **Blazing Fast** — Uses [`fast-json-stringify`](https://github.com/fastify/fast-json-stringify) with schema caching and optional pre‑compilation.
- **Strips Secret Fields** — Only fields declared in your OpenAPI response schema are serialized, preventing accidental data leaks.
- **NestJS‑native & Platform Agnostic** — Per‑route opt‑out and overrides (`@Serialize()`) and fully compatible with both Express and Fastify adapters.

### Install

```bash
npm i @nest-openapi/serializer
```

### Quick Start

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { OpenAPISerializerModule } from "@nest-openapi/serializer";
import * as openApiSpec from "./openapi.json";

@Module({
  imports: [
    OpenAPISerializerModule.forRoot({
      specSource: { type: "object", spec: openApiSpec },
      precompileSchemas: true,
      responseSerialization: { enable: true, skipErrorResponses: true },
    }),
  ],
})
export class AppModule {}
```

That's it. Successful responses are automatically serialized according to the OpenAPI response schema and best‑match `content-type`.

### Per‑route control

Use `@Serialize` to control serialization per route.

```ts
import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { Serialize } from "@nest-openapi/serializer";

@Controller("books")
export class BooksController {
  @Get(":id")
  @Serialize({ contentType: "application/json" })
  findOne(@Param("id") id: string) {
    return this.booksService.find(id);
  }

  @Post()
  @Serialize({ disable: true }) // Disable serialization for this route
  create(@Body() dto: any) {
    return this.booksService.create(dto);
  }
}
```

### Framework Support

Works with both Express and Fastify adapters.

## Next Steps

- [Options](https://nest-openapi.github.io/serializer/options) — Full configuration reference
- [Decorators](https://nest-openapi.github.io/serializer/decorators) — Per-route serialization overrides
- [Manual Serialization](https://nest-openapi.github.io/serializer/manual) — Programmatic response serialization
