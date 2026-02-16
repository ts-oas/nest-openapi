import { Inject, Injectable, Logger } from '@nestjs/common';
import { DebugUtil } from '@nest-openapi/runtime';
import { OPENAPI_MCP_OPTIONS } from '../types/tokens';
import { McpExecutor } from './executor.interface';
import { OpenAPIMcpOptions } from '../types/options.interface';
import type { McpToolDefinition } from '../types';

@Injectable()
export class FetchMcpExecutor implements McpExecutor {
  private readonly logger = new Logger('OpenAPIMcp');
  private readonly debugLog: (message: string, ...args: any[]) => void;

  constructor(
    @Inject(OPENAPI_MCP_OPTIONS)
    private readonly options: OpenAPIMcpOptions,
  ) {
    this.debugLog = DebugUtil.createDebugFn(this.logger, this.options.debug || false);
  }

  async execute(tool: McpToolDefinition, args: any, ctx: { forwardHeaders: Record<string, string> }) {
    const baseUrl = this.options.executor?.baseUrl;
    if (!baseUrl) {
      throw new Error('OpenAPI MCP executor.baseUrl is required for tool execution.');
    }

    const execParams = new Map((tool.executionParameters ?? []).map((p) => [p.name, p]));
    const pathParams: Record<string, any> = {};
    const queryParams: Record<string, any> = {};
    const headerParams: Record<string, any> = { ...ctx.forwardHeaders };
    const body = args?.requestBody;

    for (const [key, value] of Object.entries(args ?? {})) {
      if (key === 'body' || key === 'requestBody') continue;
      const param = execParams.get(key);
      if (param) {
        if (param.in === 'path') pathParams[key] = value;
        else if (param.in === 'query') queryParams[key] = value;
        else if (param.in === 'header') headerParams[key.toLowerCase()] = String(value);
      } else {
        // Fallback: if not in executionParameters, check if it's in path template
        if (tool.pathTemplate.includes(`{${key}}`)) {
          pathParams[key] = value;
        } else {
          // Default to query if not specified otherwise
          queryParams[key] = value;
        }
      }
    }

    const url = new URL(this.interpolatePath(this.joinBaseUrlAndPath(baseUrl, tool.pathTemplate), pathParams));
    for (const [key, value] of Object.entries(queryParams)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { ...headerParams };
    if (body !== undefined && body !== null && !headers['content-type']) {
      headers['content-type'] = tool.requestBodyContentType ?? 'application/json';
    }

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), this.options.executor?.timeoutMs ?? 30_000);

    const startedAt = Date.now();

    try {
      this.debugLog(`Execute start: tool="${tool.name}" method=${tool.method.toUpperCase()} path=${tool.pathTemplate}`);
      const response = await fetch(url.toString(), {
        method: tool.method.toUpperCase(),
        headers,
        body: body === undefined || body === null
          ? undefined
          : typeof body === 'string' || body instanceof ArrayBuffer || body instanceof Uint8Array
            ? (body as any)
            : JSON.stringify(body),
        signal: abort.signal,
      });

      const text = await response.text();
      let json: any = undefined;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }

      const outHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        outHeaders[k] = v;
      });

      const duration = Date.now() - startedAt;
      this.debugLog(`Execute done: tool="${tool.name}" status=${response.status} durationMs=${duration}`);

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text,
        json,
        headers: outHeaders,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private interpolatePath(pathTemplate: string, params: Record<string, any>): string {
    return pathTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(String(params[key] ?? `{${key}}`)));
  }

  private joinBaseUrlAndPath(baseUrl: string, pathTemplate: string): string {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const normalizedPath = pathTemplate.startsWith('/') ? pathTemplate : `/${pathTemplate}`;
    return `${normalizedBase}${normalizedPath}`;
  }
}
