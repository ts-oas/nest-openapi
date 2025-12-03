import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { OpenAPIMockInterceptor } from "../interceptors/openapi-mock.interceptor";
import { OPENAPI_MOCK_OPTIONS, OPENAPI_MOCK_RUNTIME, OpenAPIMockOptions } from "../types/mock-options.interface";
import { OpenAPIRuntimePool } from "@nest-openapi/runtime";
import { OPENAPI_MOCK, OpenAPIMockService } from "../services/openapi-mock.service";
import { RecordingStoreService } from "../services/recording-store.service";

@Global()
@Module({
  providers: [OpenAPIMockService],
  exports: [OpenAPIMockService],
})
export class OpenAPIMockModule {
  static forRoot(options: OpenAPIMockOptions): DynamicModule {
    const defaultOptions: Partial<OpenAPIMockOptions> = {
      enable: true,
      mockByDefault: false,
      strategyOrder: ["mediatype-examples", "schema-examples", "jsf"],
      defaultStatus: 200,
      debug: false,
    };
    const merged: OpenAPIMockOptions = { ...defaultOptions, ...options };

    const providers: Provider[] = [
      { provide: OPENAPI_MOCK_OPTIONS, useValue: merged },
      {
        provide: OPENAPI_MOCK_RUNTIME,
        useFactory: async (opts: OpenAPIMockOptions) =>
          OpenAPIRuntimePool.getOrCreate({ specSource: opts.specSource, debug: opts.debug }),
        inject: [OPENAPI_MOCK_OPTIONS],
      },
      OpenAPIMockService,
      { provide: OPENAPI_MOCK, useExisting: OpenAPIMockService },
      RecordingStoreService,
    ];

    // Only register interceptor if mocking is enabled
    if (merged.enable) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useFactory: (svc: OpenAPIMockService, recording: RecordingStoreService, reflector: Reflector) => new OpenAPIMockInterceptor(svc, recording, reflector),
        inject: [OpenAPIMockService, RecordingStoreService, Reflector],
      });
    }

    return {
      module: OpenAPIMockModule,
      global: true,
      providers,
      exports: [OPENAPI_MOCK, OpenAPIMockService, RecordingStoreService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => OpenAPIMockOptions | Promise<OpenAPIMockOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    const defaultOptions: Partial<OpenAPIMockOptions> = {
      enable: true,
      mockByDefault: false,
      strategyOrder: ["mediatype-examples", "schema-examples", "jsf"],
      defaultStatus: 200,
      debug: false,
    };

    return {
      module: OpenAPIMockModule,
      global: true,
      imports: options.imports || [],
      providers: [
        {
          provide: OPENAPI_MOCK_OPTIONS,
          useFactory: async (...args: any[]) => {
            const userOptions = await options.useFactory(...args);
            return { ...defaultOptions, ...userOptions } as OpenAPIMockOptions;
          },
          inject: options.inject || [],
        },
        {
          provide: OPENAPI_MOCK_RUNTIME,
          useFactory: async (opts: any) => OpenAPIRuntimePool.getOrCreate({ specSource: opts.specSource, debug: opts.debug }),
          inject: [OPENAPI_MOCK_OPTIONS],
        },
        OpenAPIMockService,
        { provide: OPENAPI_MOCK, useExisting: OpenAPIMockService },
        RecordingStoreService,
        {
          provide: APP_INTERCEPTOR,
          useFactory: (opts: OpenAPIMockOptions, svc: OpenAPIMockService, recording: RecordingStoreService, reflector: Reflector) => {
            if (opts.enable) {
              return new OpenAPIMockInterceptor(svc, recording, reflector);
            }
            // Return no-op interceptor when disabled
            return { intercept: (_ctx: any, next: any) => next.handle() };
          },
          inject: [OPENAPI_MOCK_OPTIONS, OpenAPIMockService, RecordingStoreService, Reflector],
        },
      ],
      exports: [OPENAPI_MOCK, OpenAPIMockService, RecordingStoreService],
    };
  }
}

