# Overview

`@nest-openapi/validator` Automatically validates request/response using your OpenAPI 3.x spec.

- **Spec‑driven** — The OpenAPI spec is the contract; validation is generated from it.
- **Fast by Design** — [AJV under the hood](https://github.com/ajv-validator/ajv), with caching and optional pre-compilation.
- **NestJS‑native** — Auto validates with per‑route opt‑out and overrides.

### Install

```bash
npm i @nest-openapi/validator
```

### Quick Start

```typescript
// app.module.ts
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
