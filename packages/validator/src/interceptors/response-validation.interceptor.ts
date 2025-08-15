import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { DebugUtil } from '@nest-openapi/runtime';
import { VALIDATE_KEY, ValidateOptions } from '../decorators/validate.decorator';
import { OPENAPI_VALIDATOR, OpenApiValidatorService } from '../services/openapi-validator.service';
import type { ValidationError } from '../types';


@Injectable()
export class ResponseValidationInterceptor implements NestInterceptor {
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

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.validatorService.openApiSpec) {
      this.debugLog('Skipped response validation - OpenAPI spec not loaded');
      return next.handle();
    }

    // Get validation configuration from decorators
    const shouldValidateResponse = this.shouldValidateResponse(context);

    if (!shouldValidateResponse) {
      this.debugLog('Skipped response validation due to configuration');
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        try {
          // Skip validation for error responses (4xx and 5xx status codes)
          const shouldSkipErrorResponses = this.validatorService.validationOptions.responseValidation?.skipErrorResponses;

          if (shouldSkipErrorResponses && response.statusCode >= 400) {
            this.debugLog(`Skipped response validation for error status code "${response.statusCode}"`);
            return data;
          }

          const errors = this.validatorService.validateResponse(httpContext, response.statusCode, data);

          if (errors.length > 0) {
            if (this.validatorService.validationOptions.responseValidation?.onValidationFailed) {
              this.validatorService.validationOptions.responseValidation.onValidationFailed(context, errors);
            } else {
              this.defaultOnValidationFailed(data, errors);
            }
          }

        } catch (error) {
          this.debugLog('Thrown error onValidationFailed', error);
          throw error;
        }

        // Always return original data when validation passes or is skipped
        return data;
      }),
    );
  }

  private shouldValidateResponse(context: ExecutionContext): boolean {
    // Check for @Validate decorator
    const validateMetadata = this.reflector.getAllAndOverride<ValidateOptions>(
      VALIDATE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (validateMetadata) {
      const { response } = validateMetadata;

      // If response is explicitly set, use that value
      if (response !== undefined) return response === true;
    }

    // Use default configuration
    return this.validatorService.validationOptions.responseValidation?.enable === true;
  }

  private defaultOnValidationFailed(data: any, errors: ValidationError[]): void {
    this.logger.warn(`Response validation failed:\nData: ${JSON.stringify(data)}\nErrors: ${JSON.stringify(errors)}`);
    throw new InternalServerErrorException({ message: 'Internal server error: Response validation failed'});
  }
}
