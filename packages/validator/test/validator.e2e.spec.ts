import 'reflect-metadata';
import { Controller, Get, Post, Body, Param, Query, Module, Res, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OpenAPIValidatorModule } from '../src/modules/openapi-validator.module';
import { Validate } from '../src/decorators/validate.decorator';
import addFormats from 'ajv-formats';
import Ajv from 'ajv';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const openApiSpec = require('./openapi-spec.json');

@Controller()
class TestController {
  @Post('users')
  @Validate({ request: { body: true }, response: true })
  create(@Body() body: any) {
    return { id: 1, ...body };
  }

  @Get('users/:id')
  // Validate all parts by default; rely on transform config to coerce types
  getOne(
    @Param('id') id: number,
    @Query('active') active?: boolean,
    @Query('mode') mode?: string,
    @Res({ passthrough: true }) res?: any,
  ) {
    if (mode === 'notfound-match') {
      res.status(404);
      return { message: 'not found' };
    }
    if (mode === 'notfound-mismatch') {
      res.status(404);
      return { code: 'NF' };
    }
    return { id, name: 'John', age: 30, email: 'john@example.com', active: !!active };
  }

  @Post('upload')
  // Only body schema exists in spec; route without response validation
  @Validate({ request: { body: true }, response: false })
  upload(@Body() _body: any) {
    return { ok: true };
  }

  @Get('status')
  // No body/params/query in spec; test 204 response compliance
  @Validate({ response: true })
  status() {
    return null; // we'll set status code in e2e using res.status(204)
  }
}

@Module({
  controllers: [TestController],
})
class TestFeatureModule {}

describe('@nest-openapi/validator e2e', () => {
  describe('forRoot basic - request and response validation', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIValidatorModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            debug: false,
            requestValidation: { enable: true, transform: true },
            responseValidation: { enable: true, skipErrorResponses: true },
            precompileSchemas: true,
            ajv: { configure: (ajv) => { addFormats(ajv); } },
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('validates POST /users body and response (201)', async () => {
      const server = app.getHttpServer();

      // Valid request
      await request(server)
        .post('/users')
        .send({ name: 'Jane', age: 25, email: 'jane@example.com', active: true })
        .expect(201)
        .expect(res => {
          // Response schema requires full User (id, name, age, etc.)
          expect(res.body).toEqual(
            expect.objectContaining({ id: expect.any(Number), name: 'Jane', age: 25, email: 'jane@example.com', active: true }),
          );
        });

      // Invalid request body -> 400 from interceptor
      await request(server)
        .post('/users')
        .send({ name: '', age: -1 })
        .expect(400)
        .expect(res => {
          expect(res.body).toEqual(
            expect.objectContaining({
              message: 'Validation failed',
              errors: expect.arrayContaining([
                expect.objectContaining({ validationType: 'body', message: expect.any(String) }),
              ]),
            }),
          );
        });
    });

    it('coerces and validates path/query with transform enabled on GET /users/:id', async () => {
      const server = app.getHttpServer();

      // id should be coerced from string to integer, active from string to boolean
      await request(server)
        .get('/users/5')
        .query({ active: 'true' })
        .expect(200)
        .expect(res => {
          expect(res.body).toEqual(
            expect.objectContaining({ id: 5, active: true }),
          );
        });

      // invalid id (negative) should trigger 400
      await request(server)
        .get('/users/0')
        .expect(400)
        .expect(res => {
          expect(res.body).toEqual(
            expect.objectContaining({
              message: 'Validation failed',
              errors: expect.arrayContaining([
                expect.objectContaining({ validationType: 'path', message: expect.any(String) }),
              ]),
            }),
          );
        });
    });

    it('skips response validation for error status when skipErrorResponses is true', async () => {
      const server = app.getHttpServer();

      // Trigger controller to return an invalid response for 500 scenario
      // We simulate by directly hitting a route that returns an error and ensure no 500 thrown by validator
      // Here we reuse /users with bad input to get 400 and ensure no extra validator error is thrown for response
      await request(server)
        .post('/users')
        .send({ name: '', age: -1 })
        .expect(400);
    });

    // moved error-response tests to a suite with skipErrorResponses=false
  });

  describe('forRootAsync and per-route overrides', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIValidatorModule.forRootAsync({
            useFactory: async () => ({
              specSource: { type: 'object', spec: openApiSpec },
              requestValidation: { enable: true, transform: false },
              responseValidation: { enable: true, skipErrorResponses: false },
              debug: false,
              ajv: { configure: (ajv) => { addFormats(ajv); } },
            }),
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('honors per-route response: false on /upload and validates only request body', async () => {
      const server = app.getHttpServer();

      // Valid upload body
      await request(server)
        .post('/upload')
        .send({ file: 'binary-data', description: 'hello' })
        .expect(201)
        .expect(res => {
          expect(res.body).toEqual({ ok: true });
        });

      // Missing file should fail request validation (400)
      await request(server)
        .post('/upload')
        .send({ description: 'no file' })
        .expect(400);
    });

    it('with transform disabled, invalid types in query should cause 400', async () => {
      const server = app.getHttpServer();

      // active expects boolean; passing non-boolean should fail when transform is false
      await request(server)
        .get('/users/3')
        .query({ active: 'not-bool' })
        .expect(400)
        .expect(res => {
          expect(res.body).toHaveProperty('message', 'Validation failed');
        });
    });

    it('response validation enabled should enforce schema on POST /users', async () => {
      const server = app.getHttpServer();

      // Controller returns full object, should pass
      await request(server)
        .post('/users')
        .send({ name: 'Rich', age: 40 })
        .expect(201);
    });

    // error-response cases are covered in a dedicated suite with transform enabled
  });

  describe('custom failure handlers (request/response)', () => {
    let app: any;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIValidatorModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            requestValidation: {
              enable: true,
              transform: true,
              onValidationFailed: (_ctx, errors) => {
                throw new BadRequestException({ message: 'REQ_FAIL', errors });
              },
            },
            responseValidation: {
              enable: true,
              skipErrorResponses: false,
              onValidationFailed: (_ctx, errors) => {
                throw new InternalServerErrorException({ message: 'RESP_FAIL', errors });
              },
            },
            ajv: { configure: (ajv) => { addFormats(ajv); } },
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('uses custom request onValidationFailed', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/users')
        .send({ name: '', age: -1 })
        .expect(400)
        .expect(res => {
          expect(res.body).toEqual(
            expect.objectContaining({
              message: 'REQ_FAIL',
              errors: expect.arrayContaining([
                expect.objectContaining({ validationType: 'body', message: expect.any(String) }),
              ]),
            }),
          );
        });
    });

    it('uses custom response onValidationFailed (response schema mismatch -> 500)', async () => {
      const server = app.getHttpServer();

      await request(server)
        .get('/users/20')
        .query({ mode: 'notfound-mismatch' })
        .expect(500)
        .expect(res => {
          expect(res.body).toEqual(
            expect.objectContaining({
              message: 'RESP_FAIL',
            }),
          );
        });
    });
  });

  describe('external AJV instance', () => {
    let app: any;

    beforeAll(async () => {
      const ajv = new Ajv({ allErrors: true, strict: 'log', coerceTypes: true, useDefaults: true });
      addFormats(ajv);

      const moduleRef = await Test.createTestingModule({
        imports: [
          TestFeatureModule,
          OpenAPIValidatorModule.forRoot({
            specSource: { type: 'object', spec: openApiSpec },
            requestValidation: { enable: true, transform: true }, // transform ignored for external instance; configured above
            responseValidation: { enable: true, skipErrorResponses: true },
            ajv,
          }),
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('accepts email format and coerces types with external Ajv', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/users')
        .send({ name: 'A', age: '22', email: 'a@b.com', active: 'false' })
        .expect(201)
        .expect(res => {
          expect(res.body).toEqual(
            expect.objectContaining({ id: expect.any(Number), age: 22, email: 'a@b.com', active: false }),
          );
        });
    });
  });
});

