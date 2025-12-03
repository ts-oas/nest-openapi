import { SetMetadata } from "@nestjs/common";
import type { OperationMockOptions } from "../types/mock-options.interface";

export const MOCK_OVERRIDE = Symbol("MOCK_OVERRIDE");

export type { OperationMockOptions };

/**
 * Decorator to override mock behavior for a specific route handler.
 *
 * @param options - Mock options to override global configuration.
 *
 * @example
 * ```
 * @Get('users/:id')
 * @Mock({ enable: true, status: 200, strategyOrder: ['mediatype-examples'] })
 * getUser(@Param('id') id: string) {
 *   // This will be mocked using examples only
 * }
 *
 * @Post('users')
 * @Mock({ enable: false })
 * createUser(@Body() dto: CreateUserDto) {
 *   // This will NOT be mocked, always hits real controller
 * }
 * ```
 */
export const Mock = (options?: OperationMockOptions) =>
  SetMetadata(MOCK_OVERRIDE, options || {});

