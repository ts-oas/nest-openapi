# Manual validation

## Validate using methods

Inject the `OpenAPIValidatorService` using the `OPENAPI_VALIDATOR` token for custom validation logic in guards, filters, services, or middleware:

```typescript
import { Injectable, Inject } from "@nestjs/common";
import { HttpArgumentsHost } from "@nestjs/common/interfaces";
import {
  OPENAPI_VALIDATOR,
  OpenAPIValidatorService,
} from "@nest-openapi/validator";

@Injectable()
export class MyService {
  constructor(
    @Inject(OPENAPI_VALIDATOR)
    private readonly validator: OpenAPIValidatorService
  ) {}

  validateData(httpContext: HttpArgumentsHost, responseBody) {
    // Validate requests manually
    const bodyOnlyErrors = this.validator.validateRequest(httpContext, {
      body: true,
      params: false,
      query: false,
    });

    // Validate responses manually
    const responseErrors = this.validator.validateResponse(
      httpContext,
      statusCode,
      responseBody
    );
  }
}
```

## Error response validation

By default, the response validation interceptor only validates successful responses that flow through the normal pipeline. However, error responses (like `NotFoundException`, `BadRequestException`, etc.) bypass interceptors and go through exception filters.

To validate error responses, inject the validator service in your exception filter:

```typescript
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  Injectable,
  Inject,
} from "@nestjs/common";
import {
  OPENAPI_VALIDATOR,
  OpenAPIValidatorService,
} from "@nest-openapi/validator";

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(OPENAPI_VALIDATOR)
    private readonly validator: OpenAPIValidatorService
  ) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = exception.getStatus?.() || 500;
    const responseBody = {
      message: exception.message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    };

    const validationErrors = this.validator.validateResponse(
      ctx,
      status,
      responseBody
    );

    if (validationErrors.length > 0) {
      console.warn("Error response validation failed:", validationErrors);
      // Handle validation errors as needed
    }

    response.status(status).json(responseBody);
  }
}
```

Then register your exception filter:

```typescript
// app.module.ts
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
```
