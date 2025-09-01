# Decorators

### Per‑route control

Use `@Serialize` to control serialization per route.

```ts
import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { Serialize } from "@nest-openapi/serializer";

@Controller("books")
export class BooksController {
  @Get(":id")
  @Serialize({ contentType: "application/json" })
  findOne(@Param("id") id: string) {
    return this.booksService.find(id);
  }

  @Post()
  @Serialize({ disable: true }) // Disable serialization for this route
  create(@Body() dto: any) {
    return this.booksService.create(dto);
  }
}
```

`@Serialize` options:

- `disable` — Disable serialization for this route.
- `contentType` — Prefer this content type when multiple are defined (e.g., `application/json`).
