<p align="center">
  <img src="https://raw.githubusercontent.com/ts-oas/nest-openapi/main/docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="80" />
</p>

<h1 align="center">@nest-openapi/mock</h1>

<p align="center"><strong>Spec-driven mock server utilities for NestJS applications</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-openapi/mock"><img src="https://img.shields.io/npm/v/@nest-openapi/mock.svg" alt="npm" /></a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" /></a>
  <a href="https://nest-openapi.github.io/mock/"><img src="https://img.shields.io/badge/docs-nest--openapi-blue" alt="Documentation" /></a>
</p>

---

## Overview

`@nest-openapi/mock` provides spec-driven mock server capabilities for NestJS applications.

- **Spec-driven** — Automatically generate mock responses matching your OpenAPI specifications.
- **Multiple strategies** — Schema examples, JSON Schema Faker, primitive values, or recorded fixtures.
- **Flexible** — Configure globally and per-route overrides (`@Mock()`), simulate network latency, HTTP header hints to trigger, and more.

### Install

```bash
npm i @nest-openapi/mock
```

### Quick Start

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { OpenAPIMockModule } from "@nest-openapi/mock";
import * as openApiSpec from "./openapi.json";

@Module({
  imports: [
    OpenAPIMockModule.forRoot({
      specSource: { type: "object", spec: openApiSpec },
      enable: process.env.NODE_ENV === "development",
      mockByDefault: true, // Mock all routes by default, like a mock server
      strategyOrder: ["mediatype-examples", "schema-examples", "jsf"],
    }),
  ],
})
export class AppModule {}
```

That's it! Your routes will return mocked responses when enabled.

### Mock Strategies

The `strategyOrder` option controls how responses are generated:

- **`records`** — Uses previously recorded responses from disk (requires `recording.dir` configuration)
- **`mediatype-examples`** — Uses `examples` from `content[mediaType].examples` in your OpenAPI spec
- **`schema-examples`** — Uses `examples` (array) or `example` (single) from the schema object itself
- **`jsf`** — Generates realistic fake data from JSON schemas using JSON Schema Faker
- **`primitive`** — Simple deterministic values (`string` → `"string"`, `number` → `0`)
- **`passthrough`** — Skips mocking and calls the real controller

Strategies are tried in order until one succeeds. Default: `["mediatype-examples", "schema-examples", "jsf"]`.

### Per-Route Control

Use `@Mock` to control mocking behavior per route.

```ts
import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { Mock } from "@nest-openapi/mock";

@Controller("users")
export class UsersController {
  @Get(":id")
  @Mock({ status: 200, strategyOrder: ["mediatype-examples", "jsf"] })
  getUser(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Mock({ enable: false }) // Disable mocking for this route
  createUser(@Body() dto: any) {
    return this.usersService.create(dto);
  }
}
```

## Next Steps

- [Configuration Options](https://nest-openapi.github.io/mock/options) — Full configuration reference
- [Decorator Usage](https://nest-openapi.github.io/mock/decorators) — Per-route overrides and precedence
- [Recording & Replay](https://nest-openapi.github.io/mock/recording) — Capture and replay mock responses
- [Manual Mock API](https://nest-openapi.github.io/mock/manual) — Programmatic mock generation
