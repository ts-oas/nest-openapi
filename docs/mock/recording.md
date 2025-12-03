# Recording & Replay

Capture real (non-mocked) controller responses to disk and replay them on subsequent requests. Useful for consistent testing, debugging, and sharing real API responses across environments.

## How It Works

1. **Real response** → Controller executes → Response saved to disk (if `capture: true`)
2. **Subsequent requests** → Replays saved response from disk (if `records` strategy is enabled)

## Configuration

Enable recording via the `recording` option:

```ts
OpenAPIMockModule.forRoot({
  specSource: { type: "object", spec: openApiSpec },
  enable: true,
  mockByDefault: false, // Real controllers run by default
  recording: {
    dir: "./recordings",
    capture: true, // Save real responses
    matchBody: false,
    redact: ["authorization", "cookie"],
  },
});
```

### Options

| Option      | Type            | Default | Description                                    |
| ----------- | --------------- | ------- | ---------------------------------------------- |
| `dir`       | `string`        | —       | Directory where recordings are stored.         |
| `capture`   | `boolean`       | `false` | Save real controller responses to disk.        |
| `matchBody` | `boolean`       | `false` | Include request body in replay key matching.   |
| `redact`    | `Array<string>` | —       | Header names to redact from stored recordings. |

## When Responses Are Captured

Responses are captured when:

1. `capture: true` is set (globally or via decorator)
2. The route is **NOT mocked** (real controller executes)

## File Structure

Recordings are organized by operation:

```
recordings/
  GET_users_{id}/
    200_application-json_abc123.json
    404_application-json_def456.json
  POST_products/
    201_application-json_xyz789.json
```

Each recording file contains:

```json
{
  "request": {
    "method": "GET",
    "path": "/users/1",
    "query": {},
    "headers": {}
  },
  "response": {
    "status": 200,
    "headers": { "content-type": "application/json" },
    "mediaType": "application/json",
    "body": { "id": 1, "name": "John Doe" }
  },
  "meta": {
    "createdAt": "2024-01-01T00:00:00.000Z",
    "version": 1
  }
}
```

## Use Cases

### Building a Recording Library

Capture real responses from your backend:

```ts
OpenAPIMockModule.forRoot({
  specSource: { type: "object", spec: openApiSpec },
  enable: true,
  mockByDefault: false, // Real controllers run
  recording: {
    dir: "./recordings",
    capture: true, // Save all real responses
  },
});
```

Run your app against the real backend, and all responses are automatically saved.

### Replay-Only Mode

Use existing recordings without capturing new ones:

```ts
OpenAPIMockModule.forRoot({
  specSource: { type: "object", spec: openApiSpec },
  enable: true,
  mockByDefault: true,
  strategyOrder: ["records", "schema-examples", "jsf"], // Try recordings first
  recording: {
    dir: "./recordings",
    capture: false, // Read-only, don't capture
  },
});
```

### Hybrid: Replay + Fill Gaps

Replay existing recordings, capture missing ones:

```ts
OpenAPIMockModule.forRoot({
  specSource: { type: "object", spec: openApiSpec },
  enable: true,
  mockByDefault: false, // Real controllers for uncaptured routes
  strategyOrder: ["records", "passthrough"], // Replay if exists, else real
  recording: {
    dir: "./recordings",
    capture: true, // Capture missing recordings
  },
});
```

## Replay Matching

Recordings are matched based on:

- Operation (method + path template)
- Status code
- Media type
- Request hash (includes query params, headers, optionally body)

When `matchBody: false`, only query params and headers are considered. When `true`, the request body is also included in the hash.

## Redacting Sensitive Data

Use `redact` to remove sensitive headers from recordings:

```ts
recording: {
  dir: "./recordings",
  capture: true,
  redact: ["authorization", "cookie", "x-api-key"],
}
```

Redacted headers are excluded from both the stored recording and the replay key.

## Per-Route Override

Override capture behavior per route using the `@Mock` decorator:

```ts
@Get('users')
@Mock({ enable: false, recording: { capture: false } })
getUsers() {
  // Real controller runs and response is NOT captured
}
```

Decorator `recording.capture` overrides the global `recording.capture` setting.

## Manual Recording API {#manual-recording-api}

Inject `OpenAPIMockService` and access the recording service via the `recording` property for programmatic control:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";
import { OPENAPI_MOCK, OpenAPIMockService } from "@nest-openapi/mock";

@Injectable()
export class MyService {
  constructor(
    @Inject(OPENAPI_MOCK)
    private readonly mockService: OpenAPIMockService
  ) {}

  async saveCustomRecording(ctx: ExecutionContext, data: any) {
    await this.mockService.recording.save(ctx, {
      operationKey: "GET /custom",
      status: 200,
      mediaType: "application/json",
      headers: { "content-type": "application/json" },
      body: data,
    });
  }

  async loadRecording(ctx: ExecutionContext) {
    return await this.mockService.recording.load(ctx, {
      operationKey: "GET /custom",
      status: 200,
      mediaType: "application/json",
    });
  }
}
```
