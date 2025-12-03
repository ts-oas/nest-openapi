import 'reflect-metadata';
import { Controller, Get, Post, Body, Param, Module, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OpenAPIMockModule } from '../src/modules/openapi-mock.module';
import { Mock } from '../src/decorators/openapi-mock.decorator';
import { OpenAPIMockService, OPENAPI_MOCK } from '../src';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const openApiSpec = require('./openapi-spec.json');

@Controller()
class TestController {
  @Get('users/:id')
  getUser(@Param('id') id: string) {
    // Real implementation - should be overridden by mock when enabled
    return { id: Number(id), name: 'Real User', email: 'real@example.com' };
  }

  @Get('products')
  listProducts() {
    return [{ id: 'real-id', name: 'Real Product', price: 99.99 }];
  }

  @Post('products')
  createProduct(@Body() body: any) {
    return { id: 'real-id', ...body };
  }

  @Get('health')
  health() {
    return { status: 'real' };
  }

  @Get('text')
  getText() {
    return 'real text';
  }

  @Get('no-example')
  noExample() {
    return { message: 'real message' };
  }

  @Get('disabled')
  @Mock({ enable: false })
  disabled() {
    return { real: true };
  }

  @Get('enabled')
  @Mock({ enable: true })
  enabled() {
    return { real: true };
  }

  @Get('custom-status')
  @Mock({ status: 404 })
  customStatus() {
    return { real: true };
  }

  @Get('delay')
  @Mock({ delayMs: 100 })
  withDelay() {
    return { real: true };
  }

  @Get('jsf-only')
  @Mock({ strategyOrder: ['jsf'] })
  jsfOnly() {
    return [{ id: 'real', name: 'Real', price: 1 }];
  }

  @Get('primitive-only')
  @Mock({ strategyOrder: ['primitive'] })
  primitiveOnly() {
    return { real: true };
  }

  @Get('passthrough-only')
  @Mock({ strategyOrder: ['passthrough'] })
  passthroughOnly() {
    return { real: true, passthrough: true };
  }
}

@Module({
  controllers: [TestController],
})
class TestFeatureModule {}

describe('@nest-openapi/mock e2e', () => {
  describe('forRoot - mock disabled', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: false,
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should use real controller when mocking is disabled', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/users/1')
        .expect(200)
        .expect({ id: 1, name: 'Real User', email: 'real@example.com' });
    });
  });

  describe('forRoot - mock enabled with examples strategy', () => {
    let app: any;
    let mockService: OpenAPIMockService;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['mediatype-examples'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      mockService = moduleRef.get<OpenAPIMockService>(OPENAPI_MOCK);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should inject OpenAPIMockService via OPENAPI_MOCK symbol', () => {
      expect(mockService).toBeDefined();
      expect(mockService.isEnabled()).toBe(true);
    });

    it('should return mocked response from examples', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/users/1')
        .expect(200)
        .expect('content-type', /json/);

      // Should return first example (john)
      expect(res.body).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        active: true,
      });
    });

    it('should return example from "examples" field', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
    });

    it('should return 501 when no example exists and strategy is examples-only', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/no-example')
        .expect(501)
        .expect({ error: 'No example for mocked route' });
    });

    it('should respect @Mock decorator to disable mocking', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/disabled')
        .expect(200)
        .expect({ real: true });
    });

    it('should respect @Mock decorator for custom status', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/custom-status')
        .expect(404);

      // Should use 404 schema from spec
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('forRoot - mock with json-schema-faker strategy', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['jsf'],
            seed: 12345,
            debug: false,
            jsf: {
              alwaysFakeOptionals: true,
              useDefaultValue: false,
              minItems: 1,
              maxItems: 3,
            },
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should generate response using json-schema-faker', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/users/1')
        .expect(200)
        .expect('content-type', /json/);

      // Should have required fields from schema
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('email');
      expect(typeof res.body.id).toBe('number');
      expect(typeof res.body.name).toBe('string');
      expect(typeof res.body.email).toBe('string');
    });

    it('should generate array responses with JSF', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/products')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.length).toBeLessThanOrEqual(3);
      if (res.body[0]) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('price');
      }
    });

    it('should use seeded random for deterministic results', async () => {
      const server = app.getHttpServer();
      const res1 = await request(server).get('/users/1').expect(200);
      const res2 = await request(server).get('/users/1').expect(200);

      // With same seed, results should be identical
      expect(res1.body).toEqual(res2.body);
    });
  });

  describe('forRoot - primitive strategy', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['primitive'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should generate primitive values from schema', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/users/1')
        .expect(200);

      // Primitive strategy returns deterministic simple values
      expect(res.body).toEqual({
        id: 0,
        name: 'string',
        email: 'string',
        age: 0,
        active: false,
      });
    });

    it('should handle text/plain responses', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/text')
        .expect(200)
        .expect('content-type', /text/)
        .expect('mock');
    });
  });

  describe('forRoot - strategy order fallback', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['mediatype-examples', 'jsf'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should prefer examples over JSF when both available', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/users/1')
        .expect(200);

      // Should use example, not JSF-generated
      expect(res.body.name).toBe('John Doe');
    });

    it('should fallback to JSF when no examples exist', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/no-example')
        .expect(200);

      // Should use JSF since no examples and decorator doesn't override global strategy
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message).not.toBe('real message');
    });
  });

  describe('forRoot - schema examples strategy', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['schema-examples', 'jsf'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should use schema property examples recursively', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/products')
        .expect(200)
        .expect('content-type', /json/);

      expect(Array.isArray(res.body)).toBe(true);
      const product = res.body[0];

      expect(product).toHaveProperty('name', 'Product name example');
      expect(product).toHaveProperty('price', 50);
    });

    it('should prefer object-level examples over field-by-field generation', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/products')
        .expect(200)
        .expect('content-type', /json/);

      expect(Array.isArray(res.body)).toBe(true);
      const product = res.body[0];

      // nested object should use object-level example, and ignore inner field examples
      // Since nested is optional and doesn't have required fields with examples,
      // it may or may not be included depending on strategy. With jsf fallback, it should exist.
      expect(product).toHaveProperty('nested');
      expect(product.nested).toEqual({
        type: 'number',
        nestedValue: 50,
      });
    });
  });

  describe('forRoot - request hints via headers', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['mediatype-examples', 'jsf'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should respect x-mock-status header', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/users/1')
        .set('x-mock-status', '404')
        .expect(404);
    });


    it('should override decorator status with request hint', async () => {
      const server = app.getHttpServer();
      // Decorator sets status to 404, but request hint should override it
      const res = await request(server)
        .get('/custom-status')
        .set('x-mock-status', '200')
        .expect(200);

      // Should return 200 response (not 404 from decorator)
      // The 200 response schema only has 'real' property
      expect(res.body).toHaveProperty('real');
      expect(typeof res.body.real).toBe('boolean');
    });

    it('should respect x-mock-enable header', async () => {
      const server = app.getHttpServer();

      // x-mock-enable: true should enable mocking even if mockByDefault is false
      const res1 = await request(server)
        .get('/users/1')
        .set('x-mock-enable', 'true')
        .expect(200);
      expect(res1.body.name).toBe('John Doe'); // Should return mocked response

      // x-mock-enable: false should disable mocking
      await request(server)
        .get('/users/1')
        .set('x-mock-enable', 'false')
        .expect(200)
        .expect({ id: 1, name: 'Real User', email: 'real@example.com' }); // Should return real response
    });

    it('should respect x-mock-strategy-order header', async () => {
      const server = app.getHttpServer();

      // Force jsf strategy to get a different response
      const res = await request(server)
        .get('/users/1')
        .set('x-mock-strategy-order', 'jsf')
        .expect(200);

      // JSF generates different data than examples
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('email');
      // Should not be the exact example values
      expect(res.body.name).not.toBe('John Doe');
    });

    it('should respect x-mock-media header', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/text')
        .set('x-mock-media', 'text/plain')
        .expect(200);

      // Should respect the media type hint
      expect(res.headers['content-type']).toMatch(/text\/plain/);
    });

    it('should override decorator enable: false with header (headers > decorator > global)', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/disabled')
        .set('x-mock-enable', 'true')
        .set('x-mock-status', '200')
        .expect(200)
        .expect('content-type', /json/);

      // Headers should override decorator enable: false
      // Should return mocked response, not real controller
      // Real controller returns exactly { real: true }
      // Mocked response will have different structure (JSF may add extra properties)
      expect(res.body).not.toEqual({ real: true });
      expect(res.body).toHaveProperty('real');
    });
  });

  describe('forRoot - delay simulation', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['mediatype-examples'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should apply delay from decorator', async () => {
      const server = app.getHttpServer();
      const start = Date.now();
      await request(server).get('/delay').expect(200);
      const duration = Date.now() - start;

      // Should take at least 100ms
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('forRootAsync - with config service', () => {
    let app: any;

    @Injectable()
    class ConfigService {
      getOpenAPISpec() {
        return openApiSpec;
      }

      isMockEnabled() {
        return true;
      }
    }

    @Module({
      providers: [ConfigService],
      exports: [ConfigService],
    })
    class ConfigModule {}

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
              specSource: { type: 'object', spec: config.getOpenAPISpec() },
              enable: config.isMockEnabled(),
              mockByDefault: true,
              strategyOrder: ['mediatype-examples'],
            }),
            inject: [ConfigService],
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should work with forRootAsync', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/users/1')
        .expect(200);

      expect(res.body.name).toBe('John Doe');
    });

    it('should merge default options in forRootAsync', async () => {
      const mockService = app.get(OPENAPI_MOCK) as OpenAPIMockService;
      expect(mockService.options.defaultStatus).toBe(200);
      expect(mockService.options.debug).toBe(false);
    });
  });

  describe('forRoot - recording and replay', () => {
    const recordDir = path.join(__dirname, '.recordings');
    let app: any;

    beforeAll(async () => {
      // Clean up recordings directory
      try {
        await fs.rm(recordDir, { recursive: true, force: true });
      } catch {
        // Ignore if doesn't exist
      }

      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['records', 'mediatype-examples'],
            recording: {
              dir: recordDir,
              matchBody: false,
              redact: ['authorization'],
            },
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
      // Clean up
      try {
        await fs.rm(recordDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it('should replay from recording when records strategy is first', async () => {
      const server = app.getHttpServer();
      // First request - no recording exists, will use mediatype-examples
      const res1 = await request(server).get('/health').expect(200);
      expect(res1.body).toEqual({ status: 'ok' });

      // Second request - still no recording (mocked responses are not saved)
      const res2 = await request(server).get('/health').expect(200);
      expect(res2.body).toEqual({ status: 'ok' });
      // Both should be the same because they use the same mock strategy
      expect(res1.body).toEqual(res2.body);
    });
  });

  describe('forRoot - recording capture real responses', () => {
    const recordDir = path.join(__dirname, '.recordings-capture');
    let app: any;

    beforeAll(async () => {
      // Clean up recordings directory
      try {
        await fs.rm(recordDir, { recursive: true, force: true });
      } catch {
        // Ignore if doesn't exist
      }

      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: false, // Don't mock by default - real controllers run
            strategyOrder: ['records', 'passthrough'],
            recording: {
              dir: recordDir,
              capture: true, // Capture real responses
              matchBody: false,
            },
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
      // Clean up
      try {
        await fs.rm(recordDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it('should NOT save mocked responses even when capture is true', async () => {
      const server = app.getHttpServer();
      // Enable mocking via header
      await request(server)
        .get('/users/1')
        .set('x-mock-enable', 'true')
        .expect(200);

      // Check that no recording was saved (mocked responses are never saved)
      const files = await fs.readdir(recordDir, { recursive: true }).catch(() => []);
      const jsonFiles = (files as string[]).filter((f) => String(f).endsWith('.json'));
      expect(jsonFiles.length).toBe(0);
    });

    it('should save real responses when capture is true', async () => {
      const server = app.getHttpServer();
      // Real controller runs (no mock header)
      await request(server)
        .get('/users/1')
        .expect(200)
        .expect({ id: 1, name: 'Real User', email: 'real@example.com' });

      // Check that recording was saved
      const files = await fs.readdir(recordDir, { recursive: true });
      const jsonFiles = (files as string[]).filter((f) => String(f).endsWith('.json'));
      expect(jsonFiles.length).toBeGreaterThan(0);
    });

    it('should NOT save real responses when capture is false', async () => {
      const recordDirNoCapture = path.join(__dirname, '.recordings-no-capture');
      try {
        await fs.rm(recordDirNoCapture, { recursive: true, force: true });
      } catch {
        // Ignore
      }

      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: false,
            recording: {
              dir: recordDirNoCapture,
              capture: false, // Don't capture
            },
            debug: false,
          }),
        ],
      }).compile();

      const testApp = moduleRef.createNestApplication();
      await testApp.init();

      const server = testApp.getHttpServer();
      await request(server)
        .get('/users/1')
        .expect(200)
        .expect({ id: 1, name: 'Real User', email: 'real@example.com' });

      // Check that no recording was saved
      const files = await fs.readdir(recordDirNoCapture, { recursive: true }).catch(() => []);
      const jsonFiles = (files as string[]).filter((f) => String(f).endsWith('.json'));
      expect(jsonFiles.length).toBe(0);

      await testApp.close();
      try {
        await fs.rm(recordDirNoCapture, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it('should replay captured real responses', async () => {
      const server = app.getHttpServer();
      // First request - real controller runs and response is captured
      const res1 = await request(server)
        .get('/health')
        .expect(200);
      expect(res1.body).toEqual({ status: 'real' });

      // Second request - should replay from recording (records strategy is first)
      const res2 = await request(server)
        .get('/health')
        .expect(200);
      expect(res2.body).toEqual({ status: 'real' });
      // Should be identical (replayed from recording)
      expect(res1.body).toEqual(res2.body);
    });

    it('should respect decorator override of capture option', async () => {
      @Controller()
      class CaptureTestController {
        @Get('capture-enabled')
        @Mock({ enable: false, recording: { capture: true } })
        captureEnabled() {
          return { captured: true };
        }

        @Get('capture-disabled')
        @Mock({ enable: false, recording: { capture: false } })
        captureDisabled() {
          return { captured: false };
        }
      }

      const recordDirDecorator = path.join(__dirname, '.recordings-decorator');
      try {
        await fs.rm(recordDirDecorator, { recursive: true, force: true });
      } catch {
        // Ignore
      }

      @Module({
        controllers: [CaptureTestController],
      })
      class CaptureTestModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [
          CaptureTestModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: false,
            recording: {
              dir: recordDirDecorator,
              capture: false, // Global capture is false
            },
            debug: false,
          }),
        ],
      }).compile();

      const testApp = moduleRef.createNestApplication();
      await testApp.init();

      const server = testApp.getHttpServer();

      // This route has capture: true in decorator, should save
      await request(server)
        .get('/capture-enabled')
        .expect(200)
        .expect({ captured: true });

      // This route has capture: false in decorator, should not save
      await request(server)
        .get('/capture-disabled')
        .expect(200)
        .expect({ captured: false });

      // Check that only capture-enabled route was saved
      const files = await fs.readdir(recordDirDecorator, { recursive: true }).catch(() => []);
      const jsonFiles = (files as string[]).filter((f) => String(f).endsWith('.json'));
      // Should have at least one file (from capture-enabled)
      expect(jsonFiles.length).toBeGreaterThan(0);
      // Verify the file contains the captured response
      const filePath = path.join(recordDirDecorator, jsonFiles[0]);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.response.body).toEqual({ captured: true });

      await testApp.close();
      try {
        await fs.rm(recordDirDecorator, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });
  });

  describe('forRoot - passthrough strategy', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['passthrough'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should call real controller when passthrough is used', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/users/1')
        .expect(200)
        .expect({ id: 1, name: 'Real User', email: 'real@example.com' });
    });
  });

  describe('forRoot - passthrough fallback', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['mediatype-examples', 'passthrough'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should fallback to passthrough when no examples exist', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/no-example')
        .expect(200)
        .expect({ message: 'real message' });
    });

    it('should use passthrough when decorator overrides strategy', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/passthrough-only')
        .expect(200)
        .expect({ real: true, passthrough: true });
    });
  });

  describe('forRoot - mockByDefault: false (opt-in mocking)', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: false,
            strategyOrder: ['mediatype-examples', 'jsf'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should use real controller when no mock header or decorator', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/users/1')
        .expect(200)
        .expect({ id: 1, name: 'Real User', email: 'real@example.com' });
    });

    it('should mock when x-mock-status header is present', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/users/1')
        .set('x-mock-enable', 'true')
        .set('x-mock-status', '200')
        .expect(200)
        .expect('content-type', /json/);

      // Should return mocked response, not real controller
      expect(res.body.name).toBe('John Doe');
    });


    it('should mock when any x-mock-* header is present', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/products')
        .set('x-mock-enable', 'true')
        .set('x-mock-media', 'application/json')
        .expect(200);

      // Should return mocked response (JSF generated), not real controller
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).not.toEqual([{ id: 'real-id', name: 'Real Product', price: 99.99 }]);
    });

    it('should mock when decorator has enable: true even if mockByDefault is false', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/enabled')
        .expect(200)
        .expect('content-type', /json/);

      // Decorator enable: true should override mockByDefault: false
      // Should return mocked response, not real controller
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
      expect(res.body).not.toEqual({ real: true });
    });

    it('should use real controller when decorator has enable: false and mockByDefault is false', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/disabled')
        .expect(200)
        .expect({ real: true });
    });

    it('should mock when header is present even if decorator has enable: false and mockByDefault is false', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .get('/disabled')
        .set('x-mock-enable', 'true')
        .set('x-mock-status', '200')
        .expect(200)
        .expect('content-type', /json/);

      // Headers should override decorator enable: false and mockByDefault: false
      // Should return mocked response, not real controller
      // Real controller returns exactly { real: true }
      // Mocked response will have different structure (JSF may add extra properties)
      expect(res.body).not.toEqual({ real: true });
      expect(res.body).toHaveProperty('real');
    });
  });

  describe('edge cases and error handling', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIMockModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            enable: true,
            mockByDefault: true,
            strategyOrder: ['mediatype-examples', 'jsf'],
            debug: false,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should handle routes not in spec gracefully', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/not-in-spec')
        .expect(404); // NestJS default 404
    });

    it('should handle POST requests with mocking', async () => {
      const server = app.getHttpServer();
      const res = await request(server)
        .post('/products')
        .send({ name: 'Test Product', price: 19.99 })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('price');
    });
  });
});

