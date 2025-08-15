import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DebugUtil } from "../utils/debug.util";
import { OpenAPISpec, SpecSource } from "../types";
import { SchemaResolverService } from "./schema-resolver.service";
export const OPENAPI_RUNTIME_OPTIONS = Symbol('OPENAPI_RUNTIME_OPTIONS');

@Injectable()
export class OpenApiRuntimeService implements OnModuleInit {
  spec!: OpenAPISpec;
  private readonly logger = new Logger('OpenApiValidator');
  private debugLog: (message: string, ...args: any[]) => void;
  public schemaResolver: SchemaResolverService;

  constructor(
    @Inject(OPENAPI_RUNTIME_OPTIONS)
    private readonly options: { specSource: SpecSource, debug?: boolean },
  ) {
    this.debugLog = DebugUtil.createDebugFn(this.logger, this.options.debug || false);
  }

  async onModuleInit(): Promise<void> {
    await this.load();
    this.schemaResolver = new SchemaResolverService(this.spec);
  }

  private async load(): Promise<void> {
    if (this.options.specSource.type === 'object') {
      this.spec = this.options.specSource.spec;
      this.debugLog('Loaded OpenAPI spec from object');
    } else if (this.options.specSource.type === 'url') {
      try {
        const text = await fetch(this.options.specSource.spec).then(r => r.text());
        this.spec = JSON.parse(text);
        this.debugLog('Loaded OpenAPI spec from URL');
      } catch (error) {
        this.debugLog('Failed to load OpenAPI spec from URL', error);
        if (error instanceof SyntaxError) throw new Error(`Invalid JSON from URL: ${this.options.specSource.spec}`);
        throw error;
      }
    } else if (this.options.specSource.type === 'file') {
      try {
        const fs = await import('fs/promises');
        const file = await fs.readFile(this.options.specSource.spec, 'utf-8');
        this.spec = JSON.parse(file);
        this.debugLog('Loaded OpenAPI spec from file');
      } catch (error: any) {
        this.debugLog('Failed to load OpenAPI spec from file', error);
        if (error instanceof SyntaxError) throw new Error(`Invalid JSON file: ${this.options.specSource.spec}`);
        if (error.code === 'ENOENT') throw new Error(`File not found: ${this.options.specSource.spec}`);
        throw error;
      }
    }

  }
}
