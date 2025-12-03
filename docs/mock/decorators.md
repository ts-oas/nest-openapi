# Decorators

### Per-route control

Use `@Mock` to control mocking behavior per route.

```ts
import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { Mock } from "@nest-openapi/mock";

@Controller("users")
export class UsersController {
  @Get(":id")
  @Mock({ status: 200, strategyOrder: ["mediatype-examples", "jsf"] })
  getUser(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Mock({ enable: false }) // Disable mocking for this route
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

`@Mock` options:

- `enable` — Explicitly enable (`true`) or disable (`false`) mocking for this route. Overrides `mockByDefault` setting.
- `strategyOrder` — Override strategy order for this route.
- `delayMs` — Add simulated latency for this route.
- `status` — Force specific HTTP status code (e.g., `404` for testing error scenarios).
- `mediaType` — Force specific media type (e.g., `application/xml`).

## Precedence

Control mocking at multiple levels. Precedence order (highest to lowest):

1. **Request hints** — Headers sent with the HTTP request
2. **Decorator** — `@Mock({ ... })` on route handlers
3. **Global config** — `forRoot({ ... })` module options

### Request Hints

Control mocking from the client side using HTTP headers:

| Header                  | Type     | Description                                                                                         |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `x-mock-enable`         | `string` | Explicitly enable (`"true"`) or disable (`"false"`) mocking. This is the primary control header.    |
| `x-mock-status`         | `number` | Force specific HTTP status code.                                                                    |
| `x-mock-media`          | `string` | Force specific media type (e.g., `application/xml`).                                                |
| `x-mock-strategy-order` | `string` | Comma-separated strategy order (e.g., `"mediatype-examples,jsf"` or `"schema-examples,primitive"`). |

**Examples:**

```ts
// Enable mocking and force 404 response
fetch("/users/1", {
  headers: {
    "x-mock-enable": "true",
    "x-mock-status": "404",
  },
});

// Override strategy order to use JSF only
fetch("/users/1", {
  headers: {
    "x-mock-enable": "true",
    "x-mock-strategy-order": "jsf",
  },
});

// Disable mocking for this request
fetch("/users/1", {
  headers: { "x-mock-enable": "false" },
});
```

Request hints override decorator settings, which override global defaults.
