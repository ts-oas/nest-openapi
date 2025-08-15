import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { DebugUtil } from '@nest-openapi/runtime';
import { VALIDATE_KEY, ValidateOptions } from '../decorators/validate.decorator';
import { OPENAPI_VALIDATOR, OpenApiValidatorService } from '../services/openapi-validator.service';
import type { ValidationError, ValidationErrorResponse } from '../types';

@Injectable()
export class RequestValidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger('OpenApiValidator');
  private debugLog: (message: string, ...args: any[]) => void;

  constructor(
    @Inject(OPENAPI_VALIDATOR)
    private readonly validatorService: OpenApiValidatorService,
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {
    this.debugLog = DebugUtil.createDebugFn(this.logger, this.validatorService.validationOptions.debug || false);
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (!this.validatorService.openApiSpec) {
      this.debugLog('Skipped request validation - OpenAPI spec not loaded');
      return next.handle();
    }

    if (this.validatorService.validationOptions.requestValidation?.enable === false) {
      this.debugLog('Skipped request validation due to configuration');
      return next.handle();
    }

    const validationConfig = this.getValidationDecorator(context);

    // Skip validation if explicitly disabled
    if (validationConfig === false) {
      this.debugLog('Skipped request validation due to configuration');
      return next.handle();
    }

    const httpContext = context.switchToHttp();

    try {
      const errors = this.validatorService.validateRequest(httpContext, validationConfig);

      if (errors.length > 0) {
        if (this.validatorService.validationOptions.requestValidation?.onValidationFailed) {
          this.validatorService.validationOptions.requestValidation.onValidationFailed(context, errors);
        } else {
          this.defaultOnValidationFailed(errors);
        }
      }
    } catch (error) {
      this.debugLog('Thrown error onValidationFailed', error);
      throw error;
    }

    return next.handle();
  }

  private getValidationDecorator(context: ExecutionContext) {
    // Check for @Validate decorator
    const validateMetadata = this.reflector.getAllAndOverride<ValidateOptions>(
      VALIDATE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (validateMetadata) {
      const { request } = validateMetadata;

      // If request is explicitly false, skip validation
      if (request === false) return false;

      // If request is explicitly true, validate all parts
      if (request === true) {
        return { params: true, query: true, body: true };
      }

      // If request is an object with specific configuration
      if (typeof request === 'object' && request !== null) {
        return {
          params: request.params ?? true,
          query: request.query ?? true,
          body: request.body ?? true,
        };
      }
    }

    // Use default configuration
    return { params: true, query: true, body: true };
  }

  private defaultOnValidationFailed(errors: ValidationError[]): void {
    throw new BadRequestException({
      message: 'Validation failed',
      errors: errors,
    } satisfies ValidationErrorResponse);
  }
}

