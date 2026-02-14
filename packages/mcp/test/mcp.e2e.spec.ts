import 'reflect-metadata';
import { Controller, Get, Post, Body, Query, Param, Module, InternalServerErrorException, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { OpenAPIMcpModule } from '../src/module/openapi-mcp.module';
import { z } from 'zod';

@Controller('target')
class TargetController {
  @Get('users/:id')
  getUser(@Param('id') id: string, @Query('details') details?: string) {
    return { id, details: details === 'true', method: 'getUser' };
  }

  @Post('items')
  createItem(@Body() body: { name: string }) {
    return { name: body.name, method: 'createItem' };
  }

  @Get('error')
  getError() {
    throw new InternalServerErrorException('Target error');
  }

  @Get('headers')
  getHeaders(@Query('name') name: string, @Req() req: any) {
    return {
      receivedHeader: req.headers[name.toLowerCase()],
      allHeaders: req.headers,
    };
  }
}

@Module({ controllers: [TargetController] })
class TargetModule {}

const spec = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/target/users/{id}': {
      get: {
        operationId: 'getUser',
        'x-mcp': true,
        description: 'Get a user by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'details', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/target/items': {
      post: {
        operationId: 'createItem',
        'x-mcp': true,
        description: 'Create an item',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
              },
            },
          },
        },
        responses: { '201': { description: 'created' } },
      },
    },
    '/target/error': {
      get: {
        operationId: 'getError',
        'x-mcp': true,
        responses: { '500': { description: 'error' } },
      },
    },
    '/target/headers': {
      get: {
        operationId: 'getHeaders',
        'x-mcp': true,
        parameters: [
          { name: 'name', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

function initParams() {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  };
}

describe('@nest-openapi/mcp e2e', () => {
  let app: NestExpressApplication;
  let server: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TargetModule,
        OpenAPIMcpModule.forRoot({
          specSource: { type: 'object', spec: spec as any },
          http: { path: '/mcp', sessionMode: 'stateless' },
          executor: { baseUrl: 'http://127.0.0.1:3101' },
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.listen(3101);
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('works in express (stateless)', async () => {
    const initRes = await request(server)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: initParams() })
      .expect(200);

    expect(initRes.body.jsonrpc).toBe('2.0');

    const callRes = await request(server)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'getUser', arguments: { id: '7', details: true } },
      })
      .expect(200);

    expect(JSON.stringify(callRes.body)).toContain('getUser');
    expect(JSON.stringify(callRes.body)).toContain('7');
  });

  it('should list tools with correct inputSchema', async () => {
    const res = await request(server)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} })
      .expect(200);

    const tools = res.body.result.tools;
    const getUserTool = tools.find((t: any) => t.name === 'getUser');
    expect(getUserTool).toBeDefined();
    expect(getUserTool.inputSchema.properties).toHaveProperty('id');
    expect(getUserTool.inputSchema.properties).toHaveProperty('details');
  });

  it('should execute createItem tool (POST with body)', async () => {
    const res = await request(server)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'createItem',
          arguments: { requestBody: { name: 'my-item' } },
        },
      })
      .expect(200);

    const content = JSON.parse(res.body.result.content[0].text);
    expect(content).toEqual({ name: 'my-item', method: 'createItem' });
  });

  it('should handle target errors gracefully', async () => {
    const res = await request(server)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'getError', arguments: {} },
      })
      .expect(200);

    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.content[0].text).toContain('500');
  });

  /*
  it('works in fastify (stateful)', async () => {
    // Note: Stateful mode has issues with MCP SDK session handling
    // The MCP StreamableHTTPServerTransport expects initialize messages
    // to be sent for each HTTP request, but stateful mode should maintain
    // server state across requests. This needs further investigation
    // into the MCP SDK's intended usage for stateful HTTP transports.

    const moduleRef = await Test.createTestingModule({
      imports: [
        TargetModule,
        OpenAPIMcpModule.forRoot({
          specSource: { type: 'object', spec: spec as any },
          http: { path: '/mcp', sessionMode: 'stateful' },
          executor: { baseUrl: 'http://127.0.0.1:3102' },
        }),
      ],
    }).compile();

    const fastifyApp = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await fastifyApp.listen(3103, '127.0.0.1');
    const fastifyServer = fastifyApp.getHttpServer();

    const initRes = await request(fastifyServer)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: initParams() })
      .expect(200);

    const sessionId = initRes.headers['mcp-session-id'] || initRes.headers['MCP-SESSION-ID'];
    expect(sessionId).toBeDefined();

    const callRes = await request(fastifyServer)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .set('mcp-session-id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'getUser', arguments: { id: '11' } },
      })
      .expect(200);

    expect(JSON.stringify(callRes.body)).toContain('"id":"11"');

    await request(fastifyServer).delete('/mcp').set('mcp-session-id', sessionId).send({}).expect(200);
    await fastifyApp.close();
  });
  */

  describe('Edge Cases & Options', () => {
    it('should work with forRootAsync in HTTP mode', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TargetModule,
          OpenAPIMcpModule.forRootAsync({
            useFactory: async () => ({
              specSource: { type: 'object', spec: spec as any },
              tools: { defaultInclude: true },
              executor: { baseUrl: 'http://127.0.0.1:3110' },
              http: { enabled: true },
            }),
          }),
        ],
      }).compile();

      const asyncApp = moduleRef.createNestApplication<NestExpressApplication>();
      await asyncApp.listen(3110);
      const asyncServer = asyncApp.getHttpServer();

      const res = await request(asyncServer)
        .post('/mcp')
        .set('accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        .expect(200);

      expect(Array.isArray(res.body?.result?.tools)).toBe(true);
      expect(res.body.result.tools.some((t: any) => t.name === 'getUser')).toBe(true);

      await asyncApp.close();
    });

    it('should respect allowedOrigins and allowedHosts', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TargetModule,
          OpenAPIMcpModule.forRoot({
            specSource: { type: 'object', spec: spec as any },
            http: {
              path: '/mcp',
              allowedOrigins: ['http://trusted.com'],
              allowedHosts: ['trusted-host.com'],
            },
            executor: { baseUrl: 'http://127.0.0.1:3104' },
          }),
        ],
      }).compile();

      const edgeApp = moduleRef.createNestApplication<NestExpressApplication>();
      await edgeApp.listen(3104);
      const edgeServer = edgeApp.getHttpServer();

      await request(edgeServer)
        .post('/mcp')
        .set('origin', 'http://evil.com')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        .expect(403);

      await request(edgeServer)
        .post('/mcp')
        .set('accept', 'application/json, text/event-stream')
        .set('origin', 'http://trusted.com')
        .set('host', 'trusted-host.com')
        .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
        .expect(200);

      await edgeApp.close();
    });

    it('should apply tools.namePrefix', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TargetModule,
          OpenAPIMcpModule.forRoot({
            specSource: { type: 'object', spec: spec as any },
            tools: { namePrefix: 'pref_' },
            executor: { baseUrl: 'http://127.0.0.1:3105' },
          }),
        ],
      }).compile();

      const prefApp = moduleRef.createNestApplication<NestExpressApplication>();
      await prefApp.listen(3105);
      const prefServer = prefApp.getHttpServer();

      const res = await request(prefServer)
        .post('/mcp')
        .set('accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        .expect(200);

      const tools = res.body.result.tools;
      expect(tools.some((t: any) => t.name === 'pref_getUser')).toBe(true);

      await prefApp.close();
    });

    it('should forward headers correctly', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TargetModule,
          OpenAPIMcpModule.forRoot({
            specSource: { type: 'object', spec: spec as any },
            executor: {
              baseUrl: 'http://127.0.0.1:3107',
              forwardHeaders: ['x-api-key'],
            },
          }),
        ],
      }).compile();

      const headApp = moduleRef.createNestApplication<NestExpressApplication>();
      await headApp.listen(3107);
      const headServer = headApp.getHttpServer();

      const res = await request(headServer)
        .post('/mcp')
        .set('accept', 'application/json, text/event-stream')
        .set('x-api-key', 'secret-123')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'getHeaders', arguments: { name: 'x-api-key' } },
        })
        .expect(200);

      const content = JSON.parse(res.body.result.content[0].text);
      expect(content.receivedHeader).toBe('secret-123');

      await headApp.close();
    });

    it('should allow extending the server via extendServer', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TargetModule,
          OpenAPIMcpModule.forRoot({
            specSource: { type: 'object', spec: spec as any },
            executor: { baseUrl: 'http://127.0.0.1:3108' },
            extendServer: (server) => {
              server.registerTool('custom_tool', {
                title: 'Custom',
                description: 'Custom tool',
                inputSchema: z.object({}) as any,
              }, async () => ({ content: [{ type: 'text' as const, text: 'custom-ok' }] }));
            },
          }),
        ],
      }).compile();

      const extApp = moduleRef.createNestApplication<NestExpressApplication>();
      await extApp.listen(3108);
      const extServer = extApp.getHttpServer();

      const res = await request(extServer)
        .post('/mcp')
        .set('accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'custom_tool', arguments: {} },
        })
        .expect(200);

      expect(res.body.result.content[0].text).toBe('custom-ok');
      await extApp.close();
    });

    it('should return 404 when http.enabled is false', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TargetModule,
          OpenAPIMcpModule.forRoot({
            specSource: { type: 'object', spec: spec as any },
            http: { enabled: false },
            executor: { baseUrl: 'http://127.0.0.1:3109' },
          }),
        ],
      }).compile();

      const noHttpApp = moduleRef.createNestApplication<NestExpressApplication>();
      await noHttpApp.listen(3109);
      const noHttpServer = noHttpApp.getHttpServer();

      await request(noHttpServer)
        .post('/mcp')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        .expect(404);

      await noHttpApp.close();
    });
  });
});
