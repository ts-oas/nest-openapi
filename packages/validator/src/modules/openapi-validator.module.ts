import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import {
  OpenAPIValidatorService,
  OPENAPI_VALIDATOR,
} from '../services/openapi-validator.service';
import { RequestValidationInterceptor } from '../interceptors/request-validation.interceptor';
import { ResponseValidationInterceptor } from '../interceptors/response-validation.interceptor';
import { ValidatorOptions } from '../types';
import { OPENAPI_RUNTIME_OPTIONS, OpenAPIRuntimePool } from '@nest-openapi/runtime';
import { OPENAPI_VALIDATOR_RUNTIME, OPENAPI_VALIDATOR_OPTIONS } from '../types/validator-options.interface';

@Global()
@Module({})
export class OpenAPIValidatorModule {
  /**
   * Configure the OpenAPI validator module with static options
   */
  static forRoot(options: ValidatorOptions): DynamicModule {
    const defaultOptions: Partial<ValidatorOptions> = {
      debug: false,
      requestValidation: { enable: true },
      responseValidation: { enable: false, skipErrorResponses: true },
    };

    const mergedOptions: ValidatorOptions = { ...defaultOptions, ...options };

    const providers: Provider[] = [
      // Validator options
      { provide: OPENAPI_VALIDATOR_OPTIONS, useValue: mergedOptions },

      // Bridge validator options -> runtime options
      {
        provide: OPENAPI_RUNTIME_OPTIONS,
        useValue: {
          specSource: mergedOptions.specSource,
          debug: mergedOptions.debug,
        },
      },

      // Core services
      {
        provide: OPENAPI_VALIDATOR_RUNTIME,
        useFactory: async (opts: ValidatorOptions) =>
          OpenAPIRuntimePool.getOrCreate({ specSource: opts.specSource, debug: opts.debug }),
        inject: [OPENAPI_VALIDATOR_OPTIONS],
      },
      OpenAPIValidatorService,
      { provide: OPENAPI_VALIDATOR, useExisting: OpenAPIValidatorService },

      // Interceptors
      { provide: APP_INTERCEPTOR, useClass: RequestValidationInterceptor },
    ];

    if (mergedOptions.responseValidation?.enable) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: ResponseValidationInterceptor,
      } as any);
    }

    return {
      module: OpenAPIValidatorModule,
      providers,
      exports: [
        OPENAPI_VALIDATOR,
        OpenAPIValidatorService,
      ],
    };
  }

  /**
   * Configure the OpenAPI validator module with async options
   */
  static forRootAsync(options: {
    imports?: any[];
    useFactory?: (...args: any[]) => ValidatorOptions | Promise<ValidatorOptions>;
    inject?: any[];
  }): DynamicModule {
    const defaultOptions: Partial<ValidatorOptions> = {
      debug: false,
      requestValidation: { enable: true },
      responseValidation: { enable: false, skipErrorResponses: true },
    };

    const providers: Provider[] = [
      // Build validator options first
      {
        provide: OPENAPI_VALIDATOR_OPTIONS,
        useFactory: async (...args: any[]) => {
          const user = options.useFactory ? await options.useFactory(...args) : ({} as Partial<ValidatorOptions>);
          return { ...defaultOptions, ...user } as ValidatorOptions;
        },
        inject: options.inject || [],
      },

      // Map validator options -> runtime options (no user config for runtime)
      {
        provide: OPENAPI_RUNTIME_OPTIONS,
        useFactory: (validatorOpts: ValidatorOptions) => ({
          specSource: validatorOpts.specSource,
          debug: validatorOpts.debug,
          precompileSchemas: validatorOpts.precompileSchemas,
        }),
        inject: [OPENAPI_VALIDATOR_OPTIONS],
      },

      // Core services
      {
        provide: OPENAPI_VALIDATOR_RUNTIME,
        useFactory: async (opts: ValidatorOptions) =>
          OpenAPIRuntimePool.getOrCreate({ specSource: opts.specSource, debug: opts.debug }),
        inject: [OPENAPI_VALIDATOR_OPTIONS],
      },
      OpenAPIValidatorService,
      { provide: OPENAPI_VALIDATOR, useExisting: OpenAPIValidatorService },

      // Interceptors
      { provide: APP_INTERCEPTOR, useClass: RequestValidationInterceptor },

      // Conditionally add response validation
      {
        provide: APP_INTERCEPTOR,
        useFactory: (
          validatorOptions: ValidatorOptions,
          validatorService: OpenAPIValidatorService,
          reflector: Reflector,
        ) => {
          if (validatorOptions.responseValidation?.enable) {
            return new ResponseValidationInterceptor(validatorService, reflector);
          }
          // no-op when disabled
          return { intercept: (_ctx: any, next: any) => next.handle() };
        },
        inject: [OPENAPI_VALIDATOR_OPTIONS, OpenAPIValidatorService, Reflector],
      } as any,
    ];

    return {
      module: OpenAPIValidatorModule,
      imports: options.imports || [],
      providers,
      exports: [
        OPENAPI_VALIDATOR,
        OpenAPIValidatorService,
      ],
    };
  }
}
