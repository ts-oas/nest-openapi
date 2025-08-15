<p align="center">
  <img src="./docs/public/nest-openapi-logo.png" alt="nest-openapi-logo" height="84" />
</p>

<h1 align="center">@nest-openapi</h1>

<p align="center"><strong>OpenAPI-first validation for NestJS</strong></p>

<p align="center">
  Single source of truth · Drop-in for existing controllers · Fast by design
</p>

[![NPM version](https://img.shields.io/npm/v/%40nest-openapi%2Fvalidator.svg)](https://www.npmjs.com/package/%40nest-openapi%2Fvalidator)
![GitHub License](https://img.shields.io/github/license/ts-oas/nest-openapi)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40nest-openapi%2Fvalidator)

## Overview

`@nest-openapi` is a light-weight, focused toolkit for OpenAPI-driven NestJS apps.
Today it ships the **request/response validator** that derives schemas from your OpenAPI spec—so you don’t duplicate DTOs or hand-roll validation rules.

- **Single Source of Truth** — The OpenAPI spec is the contract; validation is generated from it.
- **Drop-in for NestJS** — Add a module; existing controllers keep working.
- **Fast by Design** — AJV under the hood, with caching and optional pre-compilation.
- **Express & Fastify** — Platform-agnostic validation.
- **Fine-Grained Control** — Per-route opt-out and overrides.

## Package

- **`@nest-openapi/validator`** — Automatic request/response validation using your OpenAPI 3.x spec.

## Install

```bash
npm i @nest-openapi/validator
```

---

## Quick Start

### Basic Usage

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

// That's it! All routes automatically validated
```

### Advanced / Async Configuration

```typescript
// app.module.ts
@Module({
  imports: [
    OpenApiValidatorModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        specSource: { type: "object", spec: config.getOpenApiSpec() },
        options: {
          ajv: {
            options: { strict: false },
            configure: (ajv) => {
              addFormats(ajv); // import addFormats from 'ajv-formats';
            },
          },
          requestValidation: {
            enable: false,
          },
          responseValidation: {
            enable: true,
            onValidationFailed: (context, errors) => {
              console.log(errors);
            },
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Configuration Options

| Option                                      | Type                                                                                                       | Default                          | Description                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`specSource`](#specsource)                 | `{ type: "object"; spec: OpenAPISpec } \| { type: "url"; spec: string } \| { type: "file"; spec: string }` | —                                | Provide your OpenAPI 3.x spec as an object, or point to it via URL or file path.                                                       |
| [`requestValidation`](#requestvalidation)   | `RequestValidationOptions`                                                                                 | see [below](#requestvalidation)  | Controls validation of incoming requests.                                                                                              |
| [`responseValidation`](#responsevalidation) | `ResponseValidationOptions`                                                                                | see [below](#responsevalidation) | Controls validation of outgoing responses.                                                                                             |
| [`ajv`](#ajv)                               | `Ajv \| { options?: AjvOptions; configure?: (ajv: Ajv) => void }`                                          | see [below](#ajv)                | Override the default ajv instance or configure it                                                                                      |
| `precompileSchemas`                         | `boolean`                                                                                                  | `false`                          | Precompile all route schemas during application bootstrap. This removes the first-request latency at the cost of longer start-up time. |
| `debug`                                     | `boolean`                                                                                                  | `false`                          | Verbose logs for troubleshooting.                                                                                                      |

### `specSource`

| Type       | Type          | Typical use                                      |
| ---------- | ------------- | ------------------------------------------------ |
| `"object"` | `OpenAPISpec` | Static spec object.                              |
| `"url"`    | `string`      | Link to a centralized or externally hosted spec. |
| `"file"`   | `string`      | Local file path to a json file.                  |

### `requestValidation`

| Option               | Type                                                                  | Default                                             | Description                                                         |
| -------------------- | --------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `enable`             | `boolean`                                                             | `true`                                              | Enable request validation globally.                                 |
| `transform`          | `boolean`                                                             | `false`                                             | Coerce/transform inputs where schema allows (e.g., `"42"` → `42`).  |
| `onValidationFailed` | `(ctx: ExecutionContext, errors: ValidationError[]) => void \| never` | throws `BadRequestException` with validation errors | Custom handler. Transform, throw your own exception, or log/ignore. |

### `responseValidation`

| Option               | Type                                                                  | Default                                                                    | Description                                                                                                                      |
| -------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `enable`             | `boolean`                                                             | `false`                                                                    | Enable response validation globally.                                                                                             |
| `skipErrorResponses` | `boolean`                                                             | `true`                                                                     | Skip validation for error responses (4xx/5xx status codes). Cant validate thrown errors, see [here](#error-response-validation). |
| `onValidationFailed` | `(ctx: ExecutionContext, errors: ValidationError[]) => void \| never` | warns and throws `InternalServer ErrorException` without validation errors | Custom handler. Transform, throw your own exception, or log/ignore.                                                              |

### `ajv`

| Option      | Type                 | Default       | Description                                                             |
| ----------- | -------------------- | ------------- | ----------------------------------------------------------------------- |
| (itself)    | `Ajv`                | a v8 instance | Supply a fully configured AJV instance.                                 |
| `options`   | `AjvOptions`         | —             | Initialize the internal AJV with these options (e.g., `strict: false`). |
| `configure` | `(ajv: Ajv) => void` | —             | Hook to extend the instance (e.g., `addFormats(ajv)`).                  |

## Decorators

### Per-route control (skip/override)

```typescript
import { Validate } from "@nest-openapi/validator";

@Controller("users")
export class UsersController {
  @Post()
  @Validate({ request: false }) // Skip request validation for this route
  createUser(@Body() userData: any) {
    return this.usersService.create(userData);
  }

  @Get(":id")
  @Validate({ request: { param: false }, response: false }) // Skip param and response validation for this route
  getUser(@Param("id") id: string) {
    return this.usersService.findById(id);
  }
}
```

## Manual Validation

Inject the `OpenApiValidatorService` using the `OPENAPI_VALIDATOR` token for custom validation logic in guards, filters, services, or middleware:

```typescript
import { Injectable, Inject } from "@nestjs/common";
import { HttpArgumentsHost } from "@nestjs/common/interfaces";
import {
  OPENAPI_VALIDATOR,
  OpenApiValidatorService,
} from "@nest-openapi/validator";

@Injectable()
export class MyService {
  constructor(
    @Inject(OPENAPI_VALIDATOR)
    private readonly validator: OpenApiValidatorService
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

### Error Response Validation

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
  OpenApiValidatorService,
} from "@nest-openapi/validator";

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(OPENAPI_VALIDATOR)
    private readonly validator: OpenApiValidatorService
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

## Error Handling

### Handle Validation Errors

By default, the library throws:

- `BadRequestException` for request validation failures, with detailed validation errors.
- `InternalServerErrorException` for response validation failures (without detailed errors, unless you provide a custom handler).

Validation errors follow the AJV `ErrorObject` format, extended with a `validationType` property:

```json
{
  "message": "Validation failed",
  "errors": [
    {
      "validationType": "body",
      "instancePath": "/title",
      "schemaPath": "#/properties/title/type",
      "keyword": "type",
      "params": { "type": "string" },
      "message": "must be string"
    }
  ]
}
```

You can override this behavior using the onValidationFailed handler option in [requestValidation](#requestvalidation) or [responseValidation](#responsevalidation).

Inside your handler, you can whether:

- Transform the error list and throw a custom exception.
- Log and ignore errors (return without throwing).

```typescript
OpenApiValidatorModule.forRoot({
  specSource: { type: "object", spec: openApiSpec },
  requestValidation: {
    enable: true,
    onValidationFailed: (context, errors) => {
      // Custom error handling
      throw new BadRequestException({
        status: "validation_failed",
        issues: errors.map((e) => ({
          path: e.instancePath,
          message: e.message,
          received: e.data,
        })),
      });
    },
  },
});
```

## Performance and Compatibility

- Optional schema [pre-compilation](#configuration-options) removes first-hit latency at the cost of longer startup.
- Express and Fastify adopters are supported.
- Supports NestJS version >= 9
