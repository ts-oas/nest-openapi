<p align="center">
  <img src="./docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="84" />
</p>

<h1 align="center">@nest-openapi</h1>

<p align="center"><strong>OpenAPI‑first utilities for NestJS</strong></p>

<p align="center">
  Single source of truth · Drop‑in for NestJS · Fast by design
</p>

![GitHub License](https://img.shields.io/github/license/ts-oas/nest-openapi)

## Overview

`@nest-openapi` is a modern, modular set of utilities for building OpenAPI‑driven NestJS apps.

- **Single Source of Truth** — The OpenAPI spec is the contract; validation and serialization derive from it.
- **Drop‑in for NestJS** — Works with existing controllers and routes.
- **Fast by Design** — AJV validation and fast-json-stringify serialization with caching and precompilation.
- **Express & Fastify** — Platform‑agnostic support.
- **Fine‑Grained Control** — Per‑route opt‑out and overrides.

### Packages

- [**`@nest-openapi/validator`**](https://nest-openapi.github.io/validator/) — Automatic request/response validation using your OpenAPI specification.

- [**`@nest-openapi/serializer`**](https://nest-openapi.github.io/serializer/) — High‑performance response serialization based on your OpenAPI 3.x specification.

---

## Get Started

### @nest-openapi/validator

[![NPM – validator](https://img.shields.io/npm/v/%40nest-openapi%2Fvalidator.svg)](https://www.npmjs.com/package/%40nest-openapi%2Fvalidator)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40nest-openapi%2Fvalidator.svg)

Install:

```bash
npm i @nest-openapi/validator
```

Minimal setup:

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

All routes are automatically validated. **For advanced configuration, see [the docs](https://nest-openapi.github.io/validator/)**.

### @nest-openapi/serializer

[![NPM – serializer](https://img.shields.io/npm/v/%40nest-openapi%2Fserializer.svg)](https://www.npmjs.com/package/%40nest-openapi%2Fserializer)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40nest-openapi%2Fserializer.svg)

Install:

```bash
npm i @nest-openapi/serializer
```

Minimal setup:

```typescript
// app.module.ts
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

Successful responses are automatically serialized. **For advanced configuration, see [the docs](https://nest-openapi.github.io/serializer/)**.

---

## Compatibility

- Works with NestJS v9+
- Supports Express and Fastify adopters

## Contributing

Issues and PRs are welcome. Please check the package folders and docs before opening an issue.

## License

MIT © `@nest-openapi`
