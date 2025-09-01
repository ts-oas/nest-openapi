import { OpenAPIRuntimeService } from "./runtime.service";

export class OpenAPIRuntimePool {
  private static registry = new Map<string, OpenAPIRuntimeService>();

  static async getOrCreate(options: OpenAPIRuntimeService['options']): Promise<OpenAPIRuntimeService> {
    const runtime = await new OpenAPIRuntimeService(options).onModuleInit();

    const existing = this.registry.get(runtime.specHash);
    if (existing) return existing;

    this.registry.set(runtime.specHash, runtime);
    return runtime;
  }
}
