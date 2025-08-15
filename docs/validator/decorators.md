# Decorators

### Per-route control (skip/override)

Use `@Validate` to enable/disable validation per-route:

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
