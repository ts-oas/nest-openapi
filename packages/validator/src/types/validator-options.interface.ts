import Ajv, { type Options as AjvOptions } from 'ajv';
import { SpecSource } from '@nest-openapi/runtime';
import { ValidationError } from './validation-error.interface';
import { ExecutionContext } from '@nestjs/common';

export interface ValidatorOptions {
  /**
   * Provide your OpenAPI spec as an object, or point to it via URL or file path.
   *
   * Examples:
   * ```
   *   { type: "object", spec: {...} }
   *   { type: "url",    spec: "https://…" }
   *   { type: "file",   spec: "./openapi.json" }
   * ```
   */
  specSource: SpecSource;

  requestValidation?: {
    /**
     * Enable request validation
     * @default true
     */
    enable?: boolean;

    /**
     * Transform request data after validation
     * @default false
     */
    transform?: boolean;

    /**
     * Custom error handler for request validation failures.
     *
     * You can:
     * - Transform errors and throw a custom exception
     * - Log and Ignore errors (return without throwing)
     *
     * If not provided, throws `BadRequestException` with validation errors
     */
    onValidationFailed?: (context: ExecutionContext, errors: ValidationError[]) => void | never;
  };

  responseValidation?: {
    /**
     * Enable response validation
     * @default false
     */
    enable?: boolean;

    /**
     * Skip validation for error responses (4xx and 5xx status codes).
     * @default true
     */
    skipErrorResponses?: boolean;

    /**
     * Custom error handler for response validation failures.
     *
     * You can:
     * - Transform errors and throw a custom exception
     * - Log and ignore errors (return without throwing)
     *
     * If not provided, warns and throws `InternalServerErrorException` without validation errors
     */
    onValidationFailed?: (context: ExecutionContext, errors: ValidationError[]) => void | never;
  };

  /**
   * Override the default ajv instance or configure it
   */
  ajv?: Ajv | { options?: AjvOptions; configure?: (ajv: Ajv) => void };

  /**
   * Compile every request/parameter schema during application bootstrap.
   * This removes the first-request latency at the cost of longer start-up time.
   * @default false
   */
  precompileSchemas?: boolean;

  /**
   * Verbose logs for troubleshooting
   * @default false
   */
  debug?: boolean;
}

export const OPENAPI_VALIDATOR_RUNTIME = Symbol('OPENAPI_VALIDATOR_RUNTIME');
export const OPENAPI_VALIDATOR_OPTIONS = Symbol('OPENAPI_VALIDATOR_OPTIONS');
