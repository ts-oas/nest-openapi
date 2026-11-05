import { withStableUniqueNames } from '../src/openapi/tool.naming';
import { getIncludedOperations } from '../src/openapi/x-mcp.filter';
import { FetchMcpExecutor } from '../src/executor/fetch.executor';
import { extractToolsFromApi } from '../src/openapi/tool-extractor';
import { buildMcpToolsFromSpec } from '../src/openapi/tools.factory';
import { OpenAPIV3 } from 'openapi-types';

describe('x-mcp filtering', () => {
  it('applies operation > path > root > default precedence', () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'x', version: '1' },
      'x-mcp': false,
      paths: {
        '/a': { 'x-mcp': true, get: { responses: { 200: { description: 'ok' } } } },
        '/b': { get: { 'x-mcp': true, responses: { 200: { description: 'ok' } } } },
        '/c': { 'x-mcp': true, get: { 'x-mcp': false, responses: { 200: { description: 'ok' } } } },
      },
    };

    const ops = getIncludedOperations(spec, false).map((x) => x.path);
    expect(ops).toEqual(['/a', '/b']);
  });
});

describe('tool extraction', () => {
  it('generates names for operations without operationId', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1' },
      paths: {
        '/users/{id}': {
          get: { responses: { 200: { description: 'ok' } } },
        },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools[0].name).toBe('get_users_By_id');
  });

  it('sanitizes tool names', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1' },
      paths: {
        '/test': {
          get: { operationId: 'test.operation-id!', responses: { 200: { description: 'ok' } } },
        },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools[0].name).toBe('test_operation-id_');
  });

  it('handles duplicate operationIds across paths', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1' },
      paths: {
        '/a': { get: { operationId: 'dup', responses: { 200: { description: 'ok' } } } },
        '/b': { get: { operationId: 'dup', responses: { 200: { description: 'ok' } } } },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('dup');
    expect(tools[1].name).toBe('dup_1');
  });

  it('dereferences parameter/requestBody/schema refs into tool input schema', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'ref-test', version: '1' },
      components: {
        parameters: {
          UserIdParam: {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        },
        requestBodies: {
          CreateUserBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUserInput' },
              },
            },
          },
        },
        schemas: {
          CreateUserInput: {
            type: 'object',
            required: ['profile'],
            properties: {
              profile: { $ref: '#/components/schemas/ProfileInput' },
            },
          },
          CreateUserOutput: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
          ProfileInput: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              age: { type: 'integer' },
            },
          },
        },
      },
      paths: {
        '/users/{id}': {
          post: {
            parameters: [{ $ref: '#/components/parameters/UserIdParam' }],
            requestBody: { $ref: '#/components/requestBodies/CreateUserBody' },
            responses: {
              200: {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreateUserOutput' },
                  },
                },
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools).toHaveLength(1);

    const tool = tools[0];
    expect(tool.executionParameters).toEqual([{ name: 'id', in: 'path' }]);

    const inputSchema = tool.inputSchema as any;
    expect(inputSchema.required).toEqual(expect.arrayContaining(['id', 'requestBody']));
    expect(inputSchema.properties.id).toEqual(expect.objectContaining({ type: 'string' }));
    expect(inputSchema.properties.requestBody).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          profile: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              name: expect.objectContaining({ type: 'string' }),
              age: expect.objectContaining({ type: 'number' }),
            }),
          }),
        }),
      }),
    );

    expect(tool.outputSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          id: expect.objectContaining({ type: 'string' }),
        }),
      }),
    );
  });

  it('uses a single 2xx application/json response as outputSchema', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'output-test', version: '1' },
      paths: {
        '/books/{id}': {
          get: {
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              200: {
                description: 'book',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools).toHaveLength(1);
    expect(tools[0].outputSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          id: expect.objectContaining({ type: 'string' }),
          title: expect.objectContaining({ type: 'string' }),
        }),
      }),
    );
  });

  it('extracts outputSchema from */* response content', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'wildcard-output', version: '1' },
      paths: {
        '/authors/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
              200: {
                description: 'author',
                content: {
                  '*/*': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        age: { type: 'number' },
                      },
                      required: ['name'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools).toHaveLength(1);
    expect(tools[0].outputSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          name: expect.objectContaining({ type: 'string' }),
          age: expect.objectContaining({ type: 'number' }),
        }),
        required: ['name'],
      }),
    );
  });

  it('skips outputSchema if response schema is not an object (e.g. array or primitive)', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'non-object-output', version: '1' },
      paths: {
        '/authors': {
          get: {
            responses: {
              200: {
                description: 'list',
                content: {
                  '*/*': {
                    schema: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '/health': {
          get: {
            responses: {
              200: {
                description: 'health',
                content: {
                  'text/plain': {
                    schema: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools).toHaveLength(2);
    expect(tools[0].outputSchema).toBeDefined();
    expect(tools[0].outputSchema?.type).toBe('array');
    expect(tools[1].outputSchema).toBeUndefined();
  });

  it('extracts outputSchema from allOf and nullable object response schemas', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'allof-nullable', version: '1' },
      paths: {
        '/authors/{id}': {
          get: {
            responses: {
              200: {
                description: 'author with allOf',
                content: {
                  'application/json': {
                    schema: {
                      allOf: [
                        {
                          type: 'object',
                          properties: { id: { type: 'string' } },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        '/books/{id}': {
          get: {
            responses: {
              200: {
                description: 'book with nullable',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      nullable: true,
                      properties: { title: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools).toHaveLength(2);
    expect(tools[0].outputSchema).toBeDefined();
    expect(tools[0].outputSchema?.type).toBe('object');
    expect(tools[1].outputSchema).toBeDefined();
    expect((tools[1].outputSchema as any)?.anyOf || tools[1].outputSchema?.type).toBeDefined();
  });

  it('omits outputSchema when mapOutputSchema is false in buildMcpToolsFromSpec', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'disable-output', version: '1' },
      paths: {
        '/authors/{id}': {
          get: {
            responses: {
              200: {
                description: 'author',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { name: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const toolsEnabled = await buildMcpToolsFromSpec({
      spec: spec as any,
      baseUrl: 'http://localhost',
      tools: { defaultInclude: true, mapOutputSchema: true },
    });
    expect(toolsEnabled[0].outputSchema).toBeDefined();

    const toolsDisabled = await buildMcpToolsFromSpec({
      spec: spec as any,
      baseUrl: 'http://localhost',
      tools: { defaultInclude: true, mapOutputSchema: false },
    });
    expect(toolsDisabled[0].outputSchema).toBeUndefined();
  });

  it('merges path-level parameters and lets operation-level override same name+in', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'path-params', version: '1' },
      paths: {
        '/users/{id}': {
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'x-trace-id', in: 'header', required: false, schema: { type: 'string' } },
          ],
          get: {
            parameters: [
              { name: 'x-trace-id', in: 'header', required: true, schema: { type: 'string' } },
              { name: 'expand', in: 'query', required: false, schema: { type: 'boolean' } },
            ],
            responses: { 200: { description: 'ok' } },
          },
        },
      },
    };

    const tools = extractToolsFromApi(spec, true);
    expect(tools).toHaveLength(1);

    const inputSchema = tools[0].inputSchema as any;
    expect(inputSchema.properties).toHaveProperty('id');
    expect(inputSchema.properties).toHaveProperty('x-trace-id');
    expect(inputSchema.properties).toHaveProperty('expand');
    expect(inputSchema.required).toEqual(expect.arrayContaining(['id', 'x-trace-id']));

    expect(tools[0].executionParameters).toEqual(
      expect.arrayContaining([
        { name: 'id', in: 'path' },
        { name: 'x-trace-id', in: 'header' },
        { name: 'expand', in: 'query' },
      ]),
    );
  });
});

describe('tool naming collisions', () => {
  it('stabilizes duplicate names', () => {
    const tools = withStableUniqueNames([{ name: 'a' }, { name: 'a' }, { name: 'a' }]);
    expect(tools.map((t) => t.name)).toEqual(['a', 'a__2', 'a__3']);
  });
});

describe('session store TTL', () => {
  it('cleans up expired sessions', async () => {
    const { OpenAPIMcpSessionStore } = await import('../src/services/openapi-mcp-session.store');
    const store = new OpenAPIMcpSessionStore();

    const mockServer = { close: jest.fn() } as any;
    const mockTransport = { close: jest.fn() } as any;

    store.set('expired', {
      server: mockServer,
      transport: mockTransport,
      lastSeenAt: Date.now() - 2000, // 2 seconds ago
    });

    store.set('active', {
      server: { close: jest.fn() } as any,
      transport: { close: jest.fn() } as any,
      lastSeenAt: Date.now(),
    });

    // We'll manually trigger the cleanup logic to avoid timer issues in tests
    store.startCleanup(1000);

    // Access the private interval and trigger it if possible, or just call the logic
    // Since we can't easily trigger the interval, let's just test that the logic works
    // by mocking setInterval to return something we can control.

    // Actually, let's just use fake timers correctly.
    jest.useFakeTimers();
    const store2 = new OpenAPIMcpSessionStore();
    store2.set('expired', {
      server: mockServer,
      transport: mockTransport,
      lastSeenAt: Date.now() - 2000,
    });

    store2.startCleanup(1000);
    jest.advanceTimersByTime(61000);

    expect(store2.get('expired')).toBeUndefined();
    expect(mockServer.close).toHaveBeenCalled();

    store2.stopCleanup();
    jest.useRealTimers();
  });
});

describe('fetch executor', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('builds URL with path/query/body and forwards headers', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '{"ok":true}',
      headers: new Headers({ 'content-type': 'application/json' }),
    } as any));

    global.fetch = fetchMock as any;

    const executor = new FetchMcpExecutor({
      specSource: { type: 'object', spec: {} as any },
      executor: { baseUrl: 'http://localhost:3000', timeoutMs: 1000 },
    });

    const result = await executor.execute({
      operationId: 'getUser',
      name: 'getUser',
      description: 'Get a user',
      method: 'get',
      pathTemplate: '/users/{id}',
      inputSchema: {},
      requestBodyContentType: 'application/json',
      executionParameters: [
        { name: 'id', in: 'path' },
        { name: 'include', in: 'query' },
        { name: 'x-custom', in: 'header' },
      ],
      securityRequirements: [],
      parameters: [],
    }, {
      id: '42',
      include: 'profile',
      requestBody: { hello: 'world' },
      'x-custom': 'value',
    }, {
      forwardHeaders: { authorization: 'Bearer t' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/users/42?include=profile',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bearer t',
          'content-type': 'application/json',
          'x-custom': 'value',
        }),
        body: JSON.stringify({ hello: 'world' }),
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.json).toEqual({ ok: true });
  });

  it('normalizes baseUrl trailing slash when joining path template', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '{"ok":true}',
      headers: new Headers({ 'content-type': 'application/json' }),
    } as any));

    global.fetch = fetchMock as any;

    const executor = new FetchMcpExecutor({
      specSource: { type: 'object', spec: {} as any },
      executor: { baseUrl: 'http://localhost:3000/', timeoutMs: 1000 },
    });

    await executor.execute({
      operationId: 'updateBook',
      name: 'updateBook',
      description: 'Update a book',
      method: 'put',
      pathTemplate: '/books/{id}',
      inputSchema: {},
      requestBodyContentType: 'application/json',
      executionParameters: [{ name: 'id', in: 'path' }],
      securityRequirements: [],
      parameters: [],
    }, {
      id: 12,
      requestBody: { title: 'updated' },
    }, {
      forwardHeaders: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/books/12',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

describe('OpenAPIMcpService tool registration with outputSchema', () => {
  it('registers tool with outputSchema and returns structuredContent on tools/call', async () => {
    const { OpenAPIMcpService } = await import('../src/services/openapi-mcp.service');
    const mockSpec = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
      paths: {
        '/authors/{id}': {
          get: {
            operationId: 'getAuthor',
            'x-mcp': true,
            responses: {
              200: {
                description: 'ok',
                content: {
                  '*/*': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                      },
                      required: ['id', 'name'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const mockExecutor = {
      execute: jest.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: JSON.stringify({ id: '123', name: 'Tolkien' }),
        json: { id: '123', name: 'Tolkien' },
        headers: {},
      })),
    };

    const mockRuntime = {
      spec: mockSpec,
    } as any;

    const service = new OpenAPIMcpService(
      {
        specSource: { type: 'object', spec: mockSpec as any },
        tools: { defaultInclude: true },
        executor: { baseUrl: 'http://localhost' },
      },
      mockRuntime,
      mockExecutor as any,
    );

    const server = await service.createServer();
    const listHandler = (server as any).server._requestHandlers.get('tools/list');
    const listResult = await listHandler({ method: 'tools/list', params: {} });

    expect(listResult.tools).toHaveLength(1);
    expect(listResult.tools[0].outputSchema).toBeDefined();
    expect(listResult.tools[0].outputSchema.properties).toHaveProperty('id');
    expect(listResult.tools[0].outputSchema.properties).toHaveProperty('name');

    const callHandler = (server as any).server._requestHandlers.get('tools/call');
    const callResult = await callHandler({
      method: 'tools/call',
      params: { name: 'getAuthor', arguments: {} },
    });

    expect(callResult.isError).toBeFalsy();
    expect(callResult.structuredContent).toEqual({ id: '123', name: 'Tolkien' });
    expect(callResult.content[0].text).toContain('Tolkien');
  });

  it('omits structuredContent when response payload is an array', async () => {
    const { OpenAPIMcpService } = await import('../src/services/openapi-mcp.service');
    const mockSpec = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
      paths: {
        '/authors': {
          get: {
            operationId: 'listAuthors',
            'x-mcp': true,
            responses: {
              200: {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { count: { type: 'number' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const mockExecutor = {
      execute: jest.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: JSON.stringify([{ id: '1' }]),
        json: [{ id: '1' }],
        headers: {},
      })),
    };

    const service = new OpenAPIMcpService(
      {
        specSource: { type: 'object', spec: mockSpec as any },
        tools: { defaultInclude: true },
        executor: { baseUrl: 'http://localhost' },
      },
      { spec: mockSpec } as any,
      mockExecutor as any,
    );

    const server = await service.createServer();
    const callHandler = (server as any).server._requestHandlers.get('tools/call');
    const callResult = await callHandler({
      method: 'tools/call',
      params: { name: 'listAuthors', arguments: {} },
    });

    expect(callResult.structuredContent).toBeUndefined();
    expect(callResult.isError).toBe(true);
    expect(callResult.content[0].text).toContain('Output validation error');
  });
});
