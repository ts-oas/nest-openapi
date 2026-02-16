import { withStableUniqueNames } from '../src/openapi/tool.naming';
import { getIncludedOperations } from '../src/openapi/x-mcp.filter';
import { FetchMcpExecutor } from '../src/executor/fetch.executor';
import { extractToolsFromApi } from '../src/openapi/tool-extractor';
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

  it('uses first 2xx application/json response as outputSchema', () => {
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
              204: {
                description: 'no content',
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
