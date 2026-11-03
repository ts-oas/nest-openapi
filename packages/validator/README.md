<p align="center">
  <img src="https://raw.githubusercontent.com/ts-oas/nest-openapi/main/docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="80" />
</p>

<h1 align="center">@nest-openapi/validator</h1>

<p align="center"><strong>Automatic request/response validation for NestJS using your OpenAPI specifications</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-openapi/validator"><img src="https://img.shields.io/npm/v/@nest-openapi/validator.svg" alt="npm" /></a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" /></a>
  <a href="https://nest-openapi.github.io/validator/"><img src="https://img.shields.io/badge/docs-nest--openapi-blue" alt="Documentation" /></a>
</p>

---

## Overview

`@nest-openapi/validator` automatically validates request/response using your OpenAPI 3.x spec.

- **Spec‑driven** — The OpenAPI spec is the contract; validation is generated from it.
- **Fast by Design** — [AJV under the hood](https://github.com/ajv-validator/ajv), with schema caching and optional pre-compilation.
- **Full Coverage** — Validates request body, route params, query strings, and responses.
- **NestJS‑native & Platform Agnostic** — Auto validates with per‑route opt‑out and overrides (`@Validate()`) and fully compatible with both Express and Fastify adapters.

### Install

```bash
npm i @nest-openapi/validator
```

### Quick Start

```typescript
// app.module.ts
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

That's it! All routes automatically validated.

### Per-route control (skip/override)

Use `@Validate` to enable/disable validation per-route:

```typescript
import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { Validate } from "@nest-openapi/validator";

@Controller("users")
export class UsersController {
  @Post()
  @Validate({ request: false }) // Skip request validation for this route
  createUser(@Body() userData: any) {
    return this.usersService.create(userData);
  }

  @Get(":id")
  @Validate({ request: { param: false }, response: false }) // Skip param and response validation for this route
  getUser(@Param("id") id: string) {
    return this.usersService.findById(id);
  }
}
```

## Next Steps

- [Advanced setup](https://nest-openapi.github.io/validator/advanced-setup) — Custom AJV instances, formats, and failure handlers
- [Options](https://nest-openapi.github.io/validator/options) — Full configuration reference
- [Decorators](https://nest-openapi.github.io/validator/decorators) — Per-route validation overrides
- [Manual Validation](https://nest-openapi.github.io/validator/manual) — Programmatic request/response validation
