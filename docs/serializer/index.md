# Overview

`@nest-openapi/serializer` High‑performance response serialization based on your OpenAPI 3.x spec.

- **Spec‑driven** — The OpenAPI spec is the contract; serializers are generated from it.
- **Fast by default** — Uses [`fast-json-stringify`](https://github.com/fastify/fast-json-stringify) with caching and optional pre‑compilation.
- **NestJS‑native** — Auto serializes with per‑route opt‑out and overrides.

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

Works with both Express and Fastify adopters.
