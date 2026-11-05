# Overview

<div class="badges">
  <a href="https://www.npmjs.com/package/@nest-openapi/mock" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/npm/v/@nest-openapi/mock.svg" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@nest-openapi/mock" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/npm/dm/%40nest-openapi%2Fmock" alt="NPM Downloads" /></a>
  <a href="https://github.com/ts-oas/nest-openapi/blob/main/LICENSE" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/github/license/ts-oas/nest-openapi" alt="License" /></a>
  <a href="https://deepwiki.com/ts-oas/nest-openapi" target="_blank" rel="noopener noreferrer"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki" /></a>
</div>

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

**Example Strategy Priority:**

1. First, try content-level examples (`mediatype-examples`)
2. Then, try schema-level examples (`schema-examples`)
3. Finally, generate from schema using JSF (`jsf`)

**Note:** To use recorded responses, add `"records"` to your `strategyOrder` and configure `recording.dir` in options.

**Field-by-Field Generation:**
In `schema-examples` strategy, the mock service generates responses field-by-field, for example:

- When strategies are in order: `schema-examples` → `jsf` → `primitive`
- Properties with `examples` use those examples
- Properties without `examples` fall back to JSF or primitive values
- This allows partial examples (some fields have `examples`, others don't)

## Next Steps

- [Configuration Options](./options.md) — Full configuration reference
- [Decorator Usage](./decorators.md) — Per-route overrides and precedence
- [Recording & Replay](./recording.md) — Capture and replay mock responses
- [Manual Mock API](./manual.md) — Programmatic mock generation
