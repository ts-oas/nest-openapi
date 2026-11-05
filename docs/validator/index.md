# Overview

<div class="badges">
  <a href="https://www.npmjs.com/package/@nest-openapi/validator" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/npm/v/@nest-openapi/validator.svg" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@nest-openapi/validator" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/npm/dm/%40nest-openapi%2Fvalidator" alt="NPM Downloads" /></a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" /></a>
  <a href="https://deepwiki.com/ts-oas/nest-openapi" target="_blank" rel="noopener noreferrer"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki" /></a>
</div>

`@nest-openapi/validator` Automatically validates request/response using your OpenAPI 3.x spec.

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

## Next Steps

- [Advanced setup](./advanced-setup.md) — Custom AJV instances, formats, and failure handlers
- [Options](./options.md) — Full configuration reference
- [Decorators](./decorators.md) — Per-route validation overrides
- [Manual Validation](./manual.md) — Programmatic request/response validation
