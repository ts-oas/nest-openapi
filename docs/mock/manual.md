# Manual Mock API

Inject the `OpenAPIMockService` using the `OPENAPI_MOCK` token for custom mock logic in guards, filters, services, or middleware:

## Inject the service

```ts
import { Injectable, Inject } from "@nestjs/common";
import { OPENAPI_MOCK, OpenAPIMockService } from "@nest-openapi/mock";

@Injectable()
export class MyService {
  constructor(
    @Inject(OPENAPI_MOCK)
    private readonly mock: OpenAPIMockService
  ) {}
}
```

## Generate mock response manually

```ts
import { ExecutionContext } from "@nestjs/common";

async function generateMock(ctx: ExecutionContext) {
  // Create a plan
  const plan = this.mock.tryPlan(ctx, {
    status: 200,
    strategyOrder: ["mediatype-examples", "schema-examples", "jsf"],
  });

  if (!plan) {
    return null; // Operation not found or disabled
  }

  // Generate the mock response
  const result = await this.mock.generate(ctx, plan);
  return result;
}
```

---

For programmatic recording control, see [Manual Recording API](./recording.md#manual-recording-api).
