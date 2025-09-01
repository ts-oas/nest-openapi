# Manual Serialization

Inject the `OpenAPISerializerService` using the `OPENAPI_SERIALIZER` token for custom serializer logic in guards, filters, services, or middleware:

## Inject the service

```ts
import { Inject, Injectable } from "@nestjs/common";
import {
  OPENAPI_SERIALIZER,
  OpenAPISerializerService,
} from "@nest-openapi/serializer";

@Injectable()
export class MyService {
  constructor(
    @Inject(OPENAPI_SERIALIZER)
    private readonly serializer: OpenAPISerializerService
  ) {}
}
```

## Serialize a response manually

```ts
import { ExecutionContext } from "@nestjs/common";

function maybeSerialize(
  ctx: ExecutionContext,
  statusCode: number,
  body: unknown
) {
  const result = this.serializer.serializeResponse(ctx, statusCode, body);
  // result is undefined when schema not found
  if (!result) return body;

  if ("error" in result) {
    // Handle according to your policy
    return body;
  }

  // result.stringified contains the JSON string; set content-type accordingly
  return result.stringified;
}
```
