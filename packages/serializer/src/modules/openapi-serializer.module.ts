import { DynamicModule, Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { ResponseSerializerInterceptor } from "../interceptors/response-serializer.interceptor";
import { OpenAPISerializerService, OPENAPI_SERIALIZER } from "../services/openapi-serializer.service";
import {
  OPENAPI_SERIALIZER_OPTIONS,
  OPENAPI_SERIALIZER_RUNTIME,
  SerializerOptions,
} from "../types/serializer-options.interface";
import { OpenAPIRuntimePool } from "@nest-openapi/runtime";

@Global()
@Module({
  providers: [OpenAPISerializerService],
  exports: [OpenAPISerializerService],
})
export class OpenAPISerializerModule {
  static forRoot(options: SerializerOptions): DynamicModule {
    const defaultOptions: Partial<SerializerOptions> = {
      debug: false,
      precompileSchemas: false,
      responseSerialization: { enable: true, skipErrorResponses: true },
    };

    const mergedOptions: SerializerOptions = { ...defaultOptions, ...options };

    return {
      module: OpenAPISerializerModule,
      global: true,
      providers: [
        { provide: OPENAPI_SERIALIZER_OPTIONS, useValue: mergedOptions },
        {
          provide: OPENAPI_SERIALIZER_RUNTIME,
          useFactory: async (opts: SerializerOptions) =>
            OpenAPIRuntimePool.getOrCreate({ specSource: opts.specSource, debug: opts.debug }),
          inject: [OPENAPI_SERIALIZER_OPTIONS],
        },
        OpenAPISerializerService,
        { provide: OPENAPI_SERIALIZER, useExisting: OpenAPISerializerService },
        {
          provide: APP_INTERCEPTOR,
          useFactory: (serializer: OpenAPISerializerService, reflector: Reflector) =>
            new ResponseSerializerInterceptor(serializer, reflector),
          inject: [OpenAPISerializerService, Reflector],
        },
      ],
      exports: [OPENAPI_SERIALIZER, OpenAPISerializerService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => SerializerOptions | Promise<SerializerOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    return {
      module: OpenAPISerializerModule,
      global: true,
      imports: options.imports || [],
      providers: [
        {
          provide: OPENAPI_SERIALIZER_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: OPENAPI_SERIALIZER_RUNTIME,
          useFactory: async (opts: SerializerOptions) =>
            OpenAPIRuntimePool.getOrCreate({ specSource: opts.specSource, debug: opts.debug }),
          inject: [OPENAPI_SERIALIZER_OPTIONS],
        },
        OpenAPISerializerService,
        { provide: OPENAPI_SERIALIZER, useExisting: OpenAPISerializerService },
        {
          provide: APP_INTERCEPTOR,
          useFactory: (serializer: OpenAPISerializerService, reflector: Reflector) =>
            new ResponseSerializerInterceptor(serializer, reflector),
          inject: [OpenAPISerializerService, Reflector],
        },
      ],
      exports: [OPENAPI_SERIALIZER, OpenAPISerializerService],
    };
  }
}
