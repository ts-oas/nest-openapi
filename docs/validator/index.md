# Overview

`@nest-openapi/validator` Automatically validates request/response using OpenAPI 3.x spec.

- **Single Source of Truth** — The OpenAPI spec is the contract; validation is generated from it.
- **Drop-in for NestJS** — Add a module; existing controllers keep working.
- **Fast by Design** — AJV under the hood, with caching and optional pre-compilation.
- **Express & Fastify** — Platform-agnostic validation.
- **Fine-Grained Control** — Per-route opt-out and overrides.

### Install

```bash
npm i @nest-openapi/validator
```

### Quick Start

```typescript
// app.module.ts
import { OpenApiValidatorModule } from "@nest-openapi/validator";
import * as openApiSpec from "./openapi.json";

@Module({
  imports: [
    OpenApiValidatorModule.forRoot({
      specSource: { type: "object", spec: openApiSpec },
    }),
  ],
})
export class AppModule {}
```

That's it! All routes automatically validated.
