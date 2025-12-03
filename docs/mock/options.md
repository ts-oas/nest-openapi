# Options

## Configuration Options

| Option                      | Type                                                                                                       | Default                                            | Description                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`specSource`](#specsource) | `{ type: "object"; spec: OpenAPISpec } \| { type: "url"; spec: string } \| { type: "file"; spec: string }` | —                                                  | Provide your OpenAPI 3.x spec as an object, or point to it via URL or file path.                                |
| `enable`                    | `boolean`                                                                                                  | `true`                                             | Master switch: registers the mock interceptor globally. When `false`, interceptor is not registered.            |
| `mockByDefault`             | `boolean`                                                                                                  | `false`                                            | Controls default mocking behavior. When `false`, mock only when explicitly requested via headers or decorators. |
| `strategyOrder`             | `Array<"records" \| "mediatype-examples" \| "schema-examples" \| "jsf" \| "primitive" \| "passthrough">`   | `["mediatype-examples", "schema-examples", "jsf"]` | Ordered list of strategies to attempt when generating responses.                                                |
| `defaultStatus`             | `number`                                                                                                   | `200`                                              | Default HTTP status code when not specified elsewhere.                                                          |
| `seed`                      | `number \| string`                                                                                         | `undefined`                                        | Seed for deterministic mock generation. Useful for snapshot testing.                                            |
| `delayMs`                   | `number \| ((ctx: ExecutionContext) => number)`                                                            | `undefined`                                        | Simulated network latency in milliseconds.                                                                      |
| [`jsf`](#jsf)               | `object`                                                                                                   | (jsf defaults)                                     | JSON Schema Faker configuration.                                                                                |
| [`recording`](#recording)   | `object`                                                                                                   | `undefined`                                        | Recording and replay configuration.                                                                             |
| `debug`                     | `boolean`                                                                                                  | `false`                                            | Verbose logging for troubleshooting.                                                                            |

### `specSource`

| Type       | Type          | Typical use                                      |
| ---------- | ------------- | ------------------------------------------------ |
| `"object"` | `OpenAPISpec` | Static spec object.                              |
| `"url"`    | `string`      | Link to a centralized or externally hosted spec. |
| `"file"`   | `string`      | Local file path to a json/yaml file.             |

### `jsf`

JSON Schema Faker configuration:

| Option                | Type                        | Default | Description                                    |
| --------------------- | --------------------------- | ------- | ---------------------------------------------- |
| `alwaysFakeOptionals` | `boolean`                   | —       | Include optional properties in generated data. |
| `useDefaultValue`     | `boolean`                   | —       | Use schema `default` values when present.      |
| `minItems`            | `number`                    | —       | Minimum array size.                            |
| `maxItems`            | `number`                    | —       | Maximum array size.                            |
| `formats`             | `Record<string, () => any>` | —       | Custom format generators.                      |
| `extend`              | `(jsf: any) => void`        | —       | Advanced configuration hook.                   |

**Example:**

```ts
jsf: {
  alwaysFakeOptionals: true,
  useDefaultValue: true,
  minItems: 1,
  maxItems: 5,
  formats: {
    uuid: () => crypto.randomUUID(),
  },
  extend: (jsf) => {
    jsf.option("failOnInvalidTypes", false);
  },
}
```

### `recording`

Recording and replay configuration for capturing real (non-mocked) responses. See [Recording & Replay](./recording.md) for detailed documentation.

| Option      | Type            | Default | Description                                  |
| ----------- | --------------- | ------- | -------------------------------------------- |
| `dir`       | `string`        | —       | Directory to store/load recordings.          |
| `capture`   | `boolean`       | `false` | Save real controller responses to disk.      |
| `matchBody` | `boolean`       | `false` | Include request body in replay key matching. |
| `redact`    | `Array<string>` | —       | Headers to redact from stored recordings.    |

## Async Configuration

Use `forRootAsync()` for dependency injection:

```ts
MockModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    specSource: { type: "object", spec: config.get("OPENAPI_SPEC") },
    enable: config.get("MOCK_ENABLED"),
    strategyOrder: config.get("MOCK_STRATEGY").split(","),
  }),
  inject: [ConfigService],
});
```
