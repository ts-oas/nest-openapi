# Options

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

| Option               | Type                                                                  | Default                                                                    | Description                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enable`             | `boolean`                                                             | `false`                                                                    | Enable response validation globally.                                                                                                              |
| `skipErrorResponses` | `boolean`                                                             | `true`                                                                     | Skip validation for error responses (4xx/5xx status codes). Cant validate thrown errors, see [here](/validator/manual#error-response-validation). |
| `onValidationFailed` | `(ctx: ExecutionContext, errors: ValidationError[]) => void \| never` | warns and throws `InternalServer ErrorException` without validation errors | Custom handler. Transform, throw your own exception, or log/ignore.                                                                               |

### `ajv`

| Option      | Type                 | Default       | Description                                                             |
| ----------- | -------------------- | ------------- | ----------------------------------------------------------------------- |
| (itself)    | `Ajv`                | a v8 instance | Supply a fully configured AJV instance.                                 |
| `options`   | `AjvOptions`         | —             | Initialize the internal AJV with these options (e.g., `strict: false`). |
| `configure` | `(ajv: Ajv) => void` | —             | Hook to extend the instance (e.g., `addFormats(ajv)`).                  |
