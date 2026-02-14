import { DynamicModule, Global, Logger, Module, Provider } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { OPENAPI_RUNTIME_OPTIONS, OpenAPIRuntimePool } from '@nest-openapi/runtime';
import { OpenAPIMcpController } from '../controller/openapi-mcp.controller';
import { FetchMcpExecutor } from '../executor/fetch.executor';
import { OPENAPI_MCP, OpenAPIMcpService } from '../services/openapi-mcp.service';
import { OpenAPIMcpOptions } from '../types/options.interface';
import { OPENAPI_MCP_EXECUTOR, OPENAPI_MCP_OPTIONS, OPENAPI_MCP_RUNTIME, OPENAPI_MCP_RUNTIME_OPTIONS } from '../types/tokens';

@Global()
@Module({})
export class OpenAPIMcpModule {
  private static readonly logger = new Logger('OpenAPIMcp');
  static forRoot(options: OpenAPIMcpOptions): DynamicModule {
    const mergedOptions = this.mergeDefaults(options);
    const controllers = mergedOptions.http?.enabled === false ? [] : [OpenAPIMcpController];
    this.logConfigSummary('forRoot', mergedOptions);

    const providers: Provider[] = [
      { provide: OPENAPI_MCP_OPTIONS, useValue: mergedOptions },
      {
        provide: OPENAPI_MCP_RUNTIME_OPTIONS,
        useValue: {
          specSource: mergedOptions.specSource,
          debug: mergedOptions.debug ?? false,
        },
      },
      {
        provide: OPENAPI_RUNTIME_OPTIONS,
        useExisting: OPENAPI_MCP_RUNTIME_OPTIONS,
      },
      {
        provide: OPENAPI_MCP_RUNTIME,
        useFactory: async (opts: OpenAPIMcpOptions) =>
          OpenAPIRuntimePool.getOrCreate({ specSource: opts.specSource, debug: opts.debug }),
        inject: [OPENAPI_MCP_OPTIONS],
      },
      FetchMcpExecutor,
      { provide: OPENAPI_MCP_EXECUTOR, useExisting: FetchMcpExecutor },
      OpenAPIMcpService,
      { provide: OPENAPI_MCP, useExisting: OpenAPIMcpService },
    ];

    return {
      module: OpenAPIMcpModule,
      imports: this.buildRouterImport(mergedOptions),
      controllers,
      providers,
      exports: [OPENAPI_MCP, OpenAPIMcpService, OPENAPI_MCP_EXECUTOR, OPENAPI_MCP_OPTIONS],
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory?: (...args: any[]) => OpenAPIMcpOptions | Promise<OpenAPIMcpOptions>;
    inject?: any[];
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: OPENAPI_MCP_OPTIONS,
        useFactory: async (...args: any[]) => {
          const user = options.useFactory ? await options.useFactory(...args) : ({} as OpenAPIMcpOptions);
          const merged = this.mergeDefaults(user);
          if (merged.http?.enabled === false) {
            throw new Error(
              'OpenAPIMcpModule.forRootAsync does not support http.enabled=false. Use forRoot() when you need to disable HTTP exposure.',
            );
          }
          if (merged.http?.path && this.normalizePath(merged.http.path) !== 'mcp') {
            throw new Error(
              'OpenAPIMcpModule.forRootAsync currently supports only http.path="/mcp". Use forRoot() for custom HTTP path.',
            );
          }
          this.logConfigSummary('forRootAsync', merged);
          return merged;
        },
        inject: options.inject || [],
      },
      {
        provide: OPENAPI_MCP_RUNTIME_OPTIONS,
        useFactory: (opts: OpenAPIMcpOptions) => ({
          specSource: opts.specSource,
          debug: opts.debug ?? false,
        }),
        inject: [OPENAPI_MCP_OPTIONS],
      },
      {
        provide: OPENAPI_RUNTIME_OPTIONS,
        useExisting: OPENAPI_MCP_RUNTIME_OPTIONS,
      },
      {
        provide: OPENAPI_MCP_RUNTIME,
        useFactory: async (opts: OpenAPIMcpOptions) =>
          OpenAPIRuntimePool.getOrCreate({ specSource: opts.specSource, debug: opts.debug }),
        inject: [OPENAPI_MCP_OPTIONS],
      },
      FetchMcpExecutor,
      { provide: OPENAPI_MCP_EXECUTOR, useExisting: FetchMcpExecutor },
      OpenAPIMcpService,
      { provide: OPENAPI_MCP, useExisting: OpenAPIMcpService },
    ];

    return {
      module: OpenAPIMcpModule,
      global: true,
      imports: [
        ...(options.imports || []),
        RouterModule.register([{ path: 'mcp', module: OpenAPIMcpModule }]),
      ],
      controllers: [OpenAPIMcpController],
      providers,
      exports: [OPENAPI_MCP, OpenAPIMcpService, OPENAPI_MCP_EXECUTOR, OPENAPI_MCP_OPTIONS],
    };
  }

  private static buildRouterImport(options: OpenAPIMcpOptions) {
    if (options.http?.enabled === false) return [];
    return [
      RouterModule.register([
        {
          path: this.normalizePath(options.http?.path || '/mcp'),
          module: OpenAPIMcpModule,
        },
      ]),
    ];
  }

  private static normalizePath(path: string): string {
    return path.replace(/^\//, '');
  }

  private static mergeDefaults(options: OpenAPIMcpOptions): OpenAPIMcpOptions {
    return {
      ...options,
      tools: {
        defaultInclude: false,
        ...options.tools,
      },
      http: {
        enabled: true,
        path: '/mcp',
        sessionMode: 'stateless',
        sessionTtlMs: 3600_000, // 1 hour default
        ...options.http,
      },
      executor: {
        timeoutMs: 30_000,
        forwardHeaders: ['authorization'],
        ...options.executor,
      },
    };
  }

  private static logConfigSummary(source: 'forRoot' | 'forRootAsync', options: OpenAPIMcpOptions): void {
    if (!options.debug) return;

    const endpoint = options.http?.enabled === false ? '(disabled)' : (options.http?.path || '/mcp');
    // Keep logs short and high-value; avoid leaking sensitive config.
    this.logger.debug(
      `[OpenAPIMcpModule] ${source} configured: endpoint=${endpoint}, sessionMode=${options.http?.sessionMode}, defaultInclude=${options.tools?.defaultInclude}, namePrefix=${options.tools?.namePrefix || '(none)'}`,
    );
  }
}
