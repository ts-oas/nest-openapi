import { SetMetadata } from '@nestjs/common';

export const VALIDATE_OVERRIDE = Symbol("VALIDATE_OVERRIDE");

export interface ValidateOverrideOptions {
  request?: boolean | {
    params?: boolean;
    query?: boolean;
    body?: boolean;
  };
  response?: boolean;
}

/**
 * Decorator to configure validation behavior for a specific route
 *
 * @param options - Validation configuration options
 * @param options.request - Request validation settings:
 *   - `true`: Validate all request parts (params, query, body)
 *   - `false`: Skip request validation entirely
 *   - `{ params?, query?, body? }`: Validate only specified request parts
 *   - `undefined`: Use default configuration
 * @param options.response - Response validation settings:
 *   - `true`: Enable response validation
 *   - `false`: Skip response validation
 *   - `undefined`: Use default configuration
 *
 * @example In controller:
 *
 * ```typescript
 * @Controller('users')
 * export class UsersController {
 *   // Validate body and response
 *   @Put(':id')
 *   @Validate({ request: { body: true }, response: true })
 *   update(@Param('id') id: string, @Body() user: UpdateUserDto): User {
 *     return this.usersService.update(id, user);
 *   }
 * }
 * ```
 */
export const Validate = (options: ValidateOverrideOptions = {}) =>
  SetMetadata(VALIDATE_OVERRIDE, options);
