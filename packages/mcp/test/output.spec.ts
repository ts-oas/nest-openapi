import 'reflect-metadata';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenAPIRuntimeService } from '@nest-openapi/runtime';
import { OpenAPIV3 } from 'openapi-types';
import { z } from 'zod';
import { McpExecutor } from '../src/executor/executor.interface';
import { mapOpenApiSchemaToJsonSchema } from '../src/openapi/tool-extractor';
import { OpenAPIMcpService } from '../src/services/openapi-mcp.service';

type ResponseSchema = OpenAPIV3.SchemaObject | (OpenAPIV3.ReferenceObject & { nullable?: boolean });

const itemSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: { id: { type: 'string' } },
  required: ['id'],
};

/** Creates an OpenAPI success response with the supplied JSON payload schema. */
function jsonResponse(schema: ResponseSchema): OpenAPIV3.ResponseObject {
  return { description: 'Success', content: { 'application/json': { schema } } };
}

describe('MCP structured output', () => {
  let client: Client;
  let server: McpServer;
  let execute: jest.MockedFunction<McpExecutor['execute']>;

  /**
   * Connects an SDK client to a generated server over an in-memory transport.
   * Returns the advertised tool so tests exercise SDK output validation.
   */
  async function connect(schema?: ResponseSchema, responses?: OpenAPIV3.ResponsesObject) {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'Output test', version: '1.0.0' },
      components: {
        schemas: { Item: itemSchema, ...(schema ? { Payload: schema } : {}) },
        responses: {
          Success: {
            description: 'Success',
            ...(schema ? {
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Payload' } } },
            } : {}),
          },
        },
      },
      paths: {
        '/output': {
          get: {
            operationId: 'getOutput',
            responses: responses ?? { '200': { $ref: '#/components/responses/Success' } },
          },
        },
      },
    };
    execute = jest.fn();
    const service = new OpenAPIMcpService(
      {
        specSource: { type: 'object', spec },
        tools: { defaultInclude: true },
        executor: { baseUrl: 'http://localhost' },
      },
      { spec } as OpenAPIRuntimeService,
      { execute },
    );
    server = await service.createServer();
    client = new Client({ name: 'output-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    return tools[0];
  }

  /** Configures the mock executor's HTTP status and parsed or raw response body. */
  function respond(json: unknown, text = 'fallback text', ok = true, status = ok ? 200 : 500) {
    execute.mockResolvedValue({
      ok, status, statusText: ok ? 'OK' : 'Internal Server Error',
      json, text, headers: {},
    });
  }

  afterEach(async () => {
    await client?.close();
    await server?.close();
  });

  const cases: Array<{ name: string; schema: ResponseSchema; payload: unknown; wrapped: boolean }> = [
    { name: 'object', schema: itemSchema, payload: { id: '7' }, wrapped: false },
    { name: 'array of refs', schema: { type: 'array', items: { $ref: '#/components/schemas/Item' } }, payload: [{ id: '7' }], wrapped: true },
    { name: 'empty array', schema: { type: 'array', items: { type: 'string' } }, payload: [], wrapped: true },
    { name: 'zero', schema: { type: 'number' }, payload: 0, wrapped: true },
    { name: 'false', schema: { type: 'boolean' }, payload: false, wrapped: true },
    { name: 'empty string', schema: { type: 'string' }, payload: '', wrapped: true },
    { name: 'nullable object null', schema: { ...itemSchema, nullable: true }, payload: null, wrapped: true },
    { name: 'nullable object value', schema: { ...itemSchema, nullable: true }, payload: { id: '7' }, wrapped: true },
    { name: 'nullable array null', schema: { type: 'array', items: { $ref: '#/components/schemas/Item' }, nullable: true }, payload: null, wrapped: true },
    { name: 'nullable array value', schema: { type: 'array', items: { $ref: '#/components/schemas/Item' }, nullable: true }, payload: [{ id: '7' }], wrapped: true },
    { name: 'nullable enum null', schema: { type: 'string', enum: ['active'], nullable: true }, payload: null, wrapped: true },
    { name: 'nullable enum value', schema: { type: 'string', enum: ['active'], nullable: true }, payload: 'active', wrapped: true },
    { name: 'nullable ref null', schema: { $ref: '#/components/schemas/Item', nullable: true }, payload: null, wrapped: true },
    { name: 'nullable ref value', schema: { $ref: '#/components/schemas/Item', nullable: true }, payload: { id: '7' }, wrapped: true },
    { name: 'nullable allOf null', schema: { allOf: [{ $ref: '#/components/schemas/Item' }], nullable: true }, payload: null, wrapped: true },
    { name: 'nullable allOf value', schema: { allOf: [{ $ref: '#/components/schemas/Item' }], nullable: true }, payload: { id: '7' }, wrapped: true },
    { name: 'oneOf object', schema: { oneOf: [itemSchema, { type: 'string' }] }, payload: { id: '7' }, wrapped: true },
    { name: 'oneOf string', schema: { oneOf: [itemSchema, { type: 'string' }] }, payload: 'ok', wrapped: true },
  ];

  it.each(cases)('returns schema-valid structured content for $name', async ({ schema, payload, wrapped }) => {
    const tool = await connect(schema);
    expect(tool.outputSchema?.type).toBe('object');
    if (wrapped) {
      expect(tool.outputSchema?.properties).toHaveProperty('result');
      expect(tool.outputSchema?.required).toContain('result');
    } else {
      expect(tool.outputSchema?.properties).toHaveProperty('id');
    }

    respond(payload);
    const result = await client.callTool({ name: tool.name, arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual(wrapped ? { result: payload } : payload);
    expect(result.content).toEqual([{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }]);
  });

  it.each([
    { name: 'object', json: { id: '7' }, text: '{"id":"7"}', structured: { id: '7' } },
    { name: 'array', json: [1], text: '[1]', structured: { result: [1] } },
    { name: 'null', json: null, text: 'null', structured: { result: null } },
    { name: 'plain text', json: undefined, text: 'ok', structured: { result: 'ok' } },
    { name: 'empty response', json: undefined, text: '', structured: { result: '' } },
  ])('returns structured $name without an output schema', async ({ json, text, structured }) => {
    const tool = await connect();
    expect(tool.outputSchema).toBeUndefined();
    respond(json, text);
    const result = await client.callTool({ name: tool.name, arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual(structured);
    expect(result.content).toEqual([{ type: 'text', text }]);
  });

  it.each(['2XX', '2xx'])('accepts every declared success schema including %s', async (range) => {
    const tool = await connect(itemSchema, {
      '200': { $ref: '#/components/responses/Success' },
      '201': jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/Item' } }),
      [range]: jsonResponse({ type: 'boolean' }),
      '400': jsonResponse({ type: 'number' }),
    });
    expect(tool.outputSchema?.type).toBe('object');
    expect(tool.outputSchema?.required).toContain('result');
    expect(tool.outputSchema?.properties?.result).toEqual(expect.objectContaining({ anyOf: expect.any(Array) }));

    for (const [status, payload] of [[200, { id: '7' }], [201, [{ id: '7' }]], [202, false]] as const) {
      respond(payload, '', true, status);
      const result = await client.callTool({ name: tool.name, arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual({ result: payload });
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(payload) }]);
    }

    // Error response schemas must not weaken the success contract.
    respond(7);
    const invalid = await client.callTool({ name: tool.name, arguments: {} });
    expect(invalid.isError).toBe(true);
    expect(invalid.content).toEqual([{ type: 'text', text: expect.stringContaining('Output validation error') }]);
  });

  it('accepts different object schemas from multiple success statuses', async () => {
    const tool = await connect(itemSchema, {
      '200': { $ref: '#/components/responses/Success' },
      '201': jsonResponse({
        type: 'object', properties: { name: { type: 'string' } }, required: ['name'],
      }),
    });
    for (const [status, payload] of [[200, { id: '7' }], [201, { name: 'created' }]] as const) {
      respond(payload, '', true, status);
      const result = await client.callTool({ name: tool.name, arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual({ result: payload });
    }
  });

  it('keeps identical success schemas unwrapped', async () => {
    const tool = await connect(itemSchema, {
      '200': { $ref: '#/components/responses/Success' },
      '201': jsonResponse({ $ref: '#/components/schemas/Item' }),
    });
    expect(tool.outputSchema?.properties).toHaveProperty('id');
    expect(tool.outputSchema?.properties).not.toHaveProperty('result');
    respond({ id: '7' }, '', true, 201);
    const result = await client.callTool({ name: tool.name, arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({ id: '7' });
  });

  it.each([
    { name: 'empty body', status: 204, response: { description: 'No content' }, json: undefined, text: '' },
    { name: 'missing schema', status: 201, response: { description: 'Undocumented JSON', content: { 'application/json': {} } }, json: [1], text: '[1]' },
    { name: 'plain text', status: 201, response: { description: 'Text', content: { 'text/plain': { schema: { type: 'string' } } } }, json: undefined, text: 'created' },
    { name: 'unresolved response ref', status: 201, response: { $ref: '#/components/responses/Missing' }, json: [1], text: '[1]' },
  ])('omits output validation when another success response has $name', async ({ status: alternateStatus, response, json, text }) => {
    const tool = await connect(itemSchema, {
      '200': { $ref: '#/components/responses/Success' },
      [alternateStatus]: response as OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject,
    });
    expect(tool.outputSchema).toBeUndefined();
    for (const [status, payload, rawText] of [[200, { id: '7' }, '{"id":"7"}'], [alternateStatus, json, text]] as const) {
      respond(payload, rawText, true, status);
      const result = await client.callTool({ name: tool.name, arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual(status === 200 ? payload : { result: payload !== undefined ? payload : rawText });
    }
  });

  it('omits output validation when a success response also advertises a non-JSON media type', async () => {
    const tool = await connect(undefined, {
      '200': {
        description: 'JSON or text',
        content: { 'application/json': { schema: itemSchema }, 'text/plain': { schema: { type: 'string' } } },
      },
    });
    expect(tool.outputSchema).toBeUndefined();
    respond(undefined, 'plain response');
    const result = await client.callTool({ name: tool.name, arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({ result: 'plain response' });
  });

  it('still rejects output that violates the response schema', async () => {
    const tool = await connect(itemSchema);
    respond({ id: 7 });
    const result = await client.callTool({ name: tool.name, arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: expect.stringContaining('Output validation error') }]);
  });

  it('returns HTTP errors without validating against the success schema', async () => {
    const tool = await connect(itemSchema);
    respond({ message: 'failed' }, '', false);
    const result = await client.callTool({ name: tool.name, arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: '[500 Internal Server Error] {"message":"failed"}' }]);
  });

  it('returns executor failures without validating against the success schema', async () => {
    const tool = await connect(itemSchema);
    execute.mockRejectedValue(new Error('Upstream unavailable'));
    const result = await client.callTool({ name: tool.name, arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: 'Upstream unavailable' }]);
  });
});

describe('nullable schema mapping', () => {
  it('maps nested refs before applying object and array nullability', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      nullable: true,
      required: ['items'],
      properties: {
        items: { type: 'array', nullable: true, items: { $ref: '#/components/schemas/Item' } },
      },
    };
    const mapped = mapOpenApiSchemaToJsonSchema(schema, () => itemSchema);
    expect(mapped).toEqual({
      anyOf: [{
        type: 'object',
        required: ['items'],
        properties: { items: { anyOf: [{ type: 'array', items: itemSchema }, { type: 'null' }] } },
      }, { type: 'null' }],
    });

    const validator = z.fromJSONSchema(mapped as z.core.JSONSchema.JSONSchema);
    for (const value of [null, { items: null }, { items: [{ id: '7' }] }]) {
      expect(validator.safeParse(value).success).toBe(true);
    }
    for (const value of [{}, { items: [{}] }, { items: [{ id: 7 }] }]) {
      expect(validator.safeParse(value).success).toBe(false);
    }
    expect(schema.properties?.items).toEqual({
      type: 'array', nullable: true, items: { $ref: '#/components/schemas/Item' },
    });
  });
});
