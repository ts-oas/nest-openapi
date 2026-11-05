# Overview

<div class="badges">
  <a href="https://www.npmjs.com/package/@nest-openapi/serializer" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/npm/v/@nest-openapi/serializer.svg" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@nest-openapi/serializer" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/npm/dm/%40nest-openapi%2Fserializer" alt="NPM Downloads" /></a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" /></a>
  <a href="https://deepwiki.com/ts-oas/nest-openapi" target="_blank" rel="noopener noreferrer"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki" /></a>
</div>

`@nest-openapi/serializer` High‑performance response serialization based on your OpenAPI 3.x spec.

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

### Framework Support

Works with both Express and Fastify adapters.

## Next Steps

- [Options](./options.md) — Full configuration reference
- [Decorators](./decorators.md) — Per-route serialization overrides
- [Manual Serialization](./manual.md) — Programmatic response serialization
