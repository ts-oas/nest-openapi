# Advanced setup

## An advanced / async example

See [options](/validator/options) for full available configuration.

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OpenApiValidatorModule } from "@nest-openapi/validator";
import addFormats from "ajv-formats";

@Module({
  imports: [
    OpenApiValidatorModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        specSource: { type: "object", spec: config.getOpenApiSpec() },
        options: {
          ajv: {
            options: {
              strict: false,
              removeAdditional: true,
            },
            configure: (ajv) => {
              addFormats(ajv);
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

## Error handling

### Handle validation errors

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

You can override this behavior using the onValidationFailed handler option in [requestValidation](/validator/options#requestvalidation) or [responseValidation](/validator/options#responsevalidation).

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

- Optional schema [pre-compilation](/validator/options) removes first-hit latency at the cost of longer startup.
- Express and Fastify adopters are supported.
- Supports NestJS version >= 9
