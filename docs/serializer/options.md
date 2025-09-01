# Options

## Configuration Options

| Option                                            | Type                                                                                                       | Default                             | Description                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| [`specSource`](#specsource)                       | `{ type: "object"; spec: OpenAPISpec } \| { type: "url"; spec: string } \| { type: "file"; spec: string }` | —                                   | Provide your OpenAPI 3.x spec as an object, or point to it via URL or file path. |
| [`responseSerialization`](#responseserialization) | `ResponseSerializationOptions`                                                                             | see [below](#responseserialization) | Controls serialization of outgoing responses.                                    |
| [`fjs`](#fjs)                                     | `{ options: StringifyOptions}`                                                                             | —                                   | Configure `fast-json-stringify` instance.                                        |
| `precompileSchemas`                               | `boolean`                                                                                                  | `false`                             | Compile all response serializers during bootstrap to remove first‑hit latency.   |
| `debug`                                           | `boolean`                                                                                                  | `false`                             | Verbose debug logs.                                                              |

### `specSource`

| Type       | Type          | Typical use                                      |
| ---------- | ------------- | ------------------------------------------------ |
| `"object"` | `OpenAPISpec` | Static spec object.                              |
| `"url"`    | `string`      | Link to a centralized or externally hosted spec. |
| `"file"`   | `string`      | Local file path to a json file.                  |

### `responseSerialization`

| Option                  | Type                                                                                                                | Default | Description                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `enable`                | `boolean`                                                                                                           | `true`  | Enable/disable serialization globally.                                                             |
| `skipErrorResponses`    | `boolean`                                                                                                           | `true`  | Skip serializing error responses (status >= 400).                                                  |
| `onSerializationFailed` | `(args: { context: ExecutionContext; operationId?: string; statusCode: number; error: unknown; }) => void \| never` | —       | Custom error handler. Transform/throw, or log and continue. Default logs a warning and throws 500. |

### `fjs`

| Option    | Type               | Default | Description                                   |
| --------- | ------------------ | ------- | --------------------------------------------- |
| `options` | `StringifyOptions` | —       | Pass‑through options to `fast-json-stringify` |
