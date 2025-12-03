<p align="center">
  <img src="./docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="84" />
</p>

<h1 align="center">@nest-openapi</h1>

<p align="center"><strong>OpenAPI‑first utilities for NestJS</strong></p>

<p align="center">
  Single source of truth · Drop‑in for NestJS · Fast by design
</p>

[![DeepWiki](https://img.shields.io/badge/DeepWiki-ts--oas%2Fnest--openapi-blue.svg?color=teal&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/ts-oas/nest-openapi)
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

- [**`@nest-openapi/mock`**](https://nest-openapi.github.io/mock/) — Spec-driven mock server for generating realistic mock responses from your OpenAPI specification.

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

### @nest-openapi/mock

[![NPM – mock](https://img.shields.io/npm/v/%40nest-openapi%2Fmock.svg)](https://www.npmjs.com/package/%40nest-openapi%2Fmock)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40nest-openapi%2Fmock.svg)

Install:

```bash
npm i @nest-openapi/mock
```

Minimal setup:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { OpenAPIMockModule } from "@nest-openapi/mock";
import * as openApiSpec from "./openapi.json";

@Module({
  imports: [
    OpenAPIMockModule.forRoot({
      specSource: { type: "object", spec: openApiSpec },
      enable: process.env.NODE_ENV === "development",
      mockByDefault: true,
      strategyOrder: ["examples", "jsf"],
    }),
  ],
})
export class AppModule {}
```

Routes return mocked responses when enabled. **For advanced configuration, see [the docs](https://nest-openapi.github.io/mock/)**.

---

## Compatibility

- Works with NestJS v9+
- Supports Express and Fastify adopters

## Contributing

Issues and PRs are welcome. Please check the package folders and docs before opening an issue.

## License

MIT © `@nest-openapi`
