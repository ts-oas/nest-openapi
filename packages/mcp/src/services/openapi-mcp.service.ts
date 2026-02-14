import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DebugUtil, OpenAPIRuntimeService, PlatformUtil } from '@nest-openapi/runtime';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { OPENAPI_MCP_EXECUTOR, OPENAPI_MCP_OPTIONS, OPENAPI_MCP_RUNTIME } from '../types/tokens';
import { OpenAPIMcpOptions } from '../types/options.interface';
import { McpExecutor } from '../executor/executor.interface';
import { buildMcpToolsFromSpec } from '../openapi/tools.factory';
import { OpenAPIMcpSessionStore } from './openapi-mcp-session.store';
import { z } from 'zod';
import type { McpToolDefinition } from '../types';

export const OPENAPI_MCP = Symbol('OPENAPI_MCP');

@Injectable()
export class OpenAPIMcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('OpenAPIMcp');
  private readonly sessions = new OpenAPIMcpSessionStore();
  private readonly debugLog: (message: string, ...args: any[]) => void;

  constructor(
    @Inject(OPENAPI_MCP_OPTIONS) public readonly options: OpenAPIMcpOptions,
    @Inject(OPENAPI_MCP_RUNTIME) private readonly runtime: OpenAPIRuntimeService,
    @Inject(OPENAPI_MCP_EXECUTOR) private readonly executor: McpExecutor,
  ) {
    this.debugLog = DebugUtil.createDebugFn(this.logger, this.options.debug || false);
  }

  onModuleInit() {
    if (this.options.http?.sessionMode === 'stateful') {
      const ttl = this.options.http.sessionTtlMs ?? 3600_000;
      this.sessions.startCleanup(ttl);
    }
  }

  onModuleDestroy() {
    this.sessions.stopCleanup();
    this.debugLog('MCP session cleanup stopped');
  }

  async createServer(): Promise<McpServer> {
    const spec = this.runtime.spec;
    const server = new McpServer({
      name: this.options.server?.name || spec?.info?.title || 'openapi-mcp',
      version: this.options.server?.version || spec?.info?.version || '0.0.0',
    });

    const tools = await buildMcpToolsFromSpec({
      spec: this.runtime.spec,
      baseUrl: this.options.executor?.baseUrl || '',
      tools: {
        defaultInclude: this.options.tools?.defaultInclude ?? false,
        namePrefix: this.options.tools?.namePrefix,
      },
    });

    for (const tool of tools) {
      this.registerTool(server, tool);
    }

    this.debugLog(
      `Created MCP server name="${this.options.server?.name || spec?.info?.title || 'openapi-mcp'}" version="${this.options.server?.version || spec?.info?.version || '0.0.0'}" with ${tools.length} tool(s)`,
    );

    await this.options.extendServer?.(server);
    if (this.options.extendServer) this.debugLog('Applied extendServer hook');

    return server;
  }

  async startStdio(): Promise<void> {
    const server = await this.createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    this.debugLog('Connected MCP server over stdio transport');
  }

  async handleHttp(rawReq: any, rawRes: any, parsedBody?: unknown): Promise<void> {
    if (!this.isRequestAllowed(rawReq, rawRes)) return;

    if (this.options.http?.sessionMode === 'stateful') {
      await this.handleStateful(rawReq, rawRes, parsedBody);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    const server = await this.createServer();
    await server.connect(transport);

    try {
      await transport.handleRequest(rawReq, rawRes, parsedBody);
    } finally {
      await transport.close?.();
      await server.close?.();
    }
  }

  private async handleStateful(rawReq: any, rawRes: any, parsedBody?: unknown): Promise<void> {
    const idFromHeader = String(rawReq?.headers?.['mcp-session-id'] ?? '');
    let sessionId = idFromHeader;
    let session = sessionId ? this.sessions.get(sessionId) : undefined;

    if (!session) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => Math.random().toString(36).substring(2),
        enableJsonResponse: true,
      });
      const server = await this.createServer();
      await server.connect(transport);
      sessionId = transport.sessionId;
      session = { server, transport, lastSeenAt: Date.now() };
      if (sessionId) this.sessions.set(sessionId, session);
      this.debugLog(`Created MCP stateful session id=${sessionId}`);
    }

    if (sessionId) {
      // Try PlatformUtil first
      try {
        const mockHttpContext = {
          getResponse: () => rawRes,
        };
        PlatformUtil.setHeader(mockHttpContext as any, 'mcp-session-id', sessionId);
      } catch (error: any) {
        this.logger.error(error?.message || 'Failed to set MCP session ID header');
        // Multiple fallback approaches for different frameworks
        if (typeof rawRes.setHeader === 'function') {
          rawRes.setHeader('mcp-session-id', sessionId);
        } else if (typeof rawRes.header === 'function') {
          rawRes.header('mcp-session-id', sessionId);
        } else if (rawRes.headers) {
          rawRes.headers['mcp-session-id'] = sessionId;
        } else if (rawRes.raw && typeof rawRes.raw.setHeader === 'function') {
          rawRes.raw.setHeader('mcp-session-id', sessionId);
        } else if (rawRes.res && typeof rawRes.res.setHeader === 'function') {
          rawRes.res.setHeader('mcp-session-id', sessionId);
        }
      }
    }
    session.lastSeenAt = Date.now();
    await session.transport.handleRequest(rawReq, rawRes, parsedBody);

    if (rawReq?.method === 'DELETE' && sessionId) {
      this.sessions.delete(sessionId);
      await session.transport.close?.();
      await session.server.close?.();
      this.debugLog(`Closed MCP stateful session id=${sessionId}`);
    }
  }

  private registerTool(server: McpServer, tool: McpToolDefinition) {
    server.registerTool(tool.name, {
      title: tool.name,
      description: tool.description,
      inputSchema: z.fromJSONSchema(tool.inputSchema as z.core.JSONSchema.JSONSchema),
      outputSchema: tool.outputSchema ? z.fromJSONSchema(tool.outputSchema as z.core.JSONSchema.JSONSchema) : undefined,
    }, async (args: any, extra: any) => {
      try {
        const allowlist = this.options.executor?.forwardHeaders ?? ['authorization'];
        const forwarded = this.pickForwardHeaders(extra?.requestInfo?.headers ?? {}, allowlist);
        const result = await this.executor.execute(tool, args, { forwardHeaders: forwarded });
        const payload = result.json ?? result.text;
        const text = typeof payload === 'string' ? payload : JSON.stringify(payload);

        if (result.ok) {
          this.debugLog(`MCP tool "${tool.name}" completed with status=${result.status}`);
          return { content: [{ type: 'text' as const, text }] };
        }

        this.debugLog(`MCP tool "${tool.name}" returned error status=${result.status}`);

        return {
          content: [{ type: 'text' as const, text: `[${result.status} ${result.statusText}] ${text}` }],
          isError: true,
        };
      } catch (error: any) {
        this.logger.error(error?.message || 'MCP tool execution failed');
        return {
          content: [{ type: 'text' as const, text: error?.message || 'MCP tool execution failed' }],
          isError: true,
        };
      }
    });
  }

  private pickForwardHeaders(headers: Record<string, any>, allowlist: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of allowlist) {
      const value = headers?.[name] ?? headers?.[name.toLowerCase()];
      if (typeof value === 'string') out[name.toLowerCase()] = value;
    }
    return out;
  }

  private isRequestAllowed(rawReq: any, rawRes: any): boolean {
    const host = String(rawReq?.headers?.host ?? '');
    const origin = String(rawReq?.headers?.origin ?? '');

    const allowedHosts = this.options.http?.allowedHosts;
    if (allowedHosts?.length && !allowedHosts.includes(host)) {
      this.debugLog(`Rejected MCP request due to host allowlist miss: host=${host}`);
      rawRes.statusCode = 403;
      rawRes.end('Forbidden host');
      return false;
    }

    const allowedOrigins = this.options.http?.allowedOrigins;
    if (allowedOrigins?.length && origin && !allowedOrigins.includes(origin)) {
      this.debugLog(`Rejected MCP request due to origin allowlist miss: origin=${origin}`);
      rawRes.statusCode = 403;
      rawRes.end('Forbidden origin');
      return false;
    }

    return true;
  }
}
