import { Injectable, Logger, Inject, OnApplicationBootstrap } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { OpenAPIRuntimeService, OpenAPISpec, DebugUtil, PlatformUtil } from '@nest-openapi/runtime';
import Ajv from 'ajv';
import type { ValidatorOptions, ValidationError } from '../types';
import { OPENAPI_VALIDATOR_OPTIONS, OPENAPI_VALIDATOR_RUNTIME } from '../types/validator-options.interface';

export const OPENAPI_VALIDATOR = Symbol('OPENAPI_VALIDATOR');

@Injectable()
export class OpenAPIValidatorService implements OnApplicationBootstrap {
  private readonly logger = new Logger('OpenAPIValidator');
  private ajv: Ajv;
  public openApiSpec: OpenAPISpec;
  private debugLog: (message: string, ...args: any[]) => void;

  constructor(
    @Inject(OPENAPI_VALIDATOR_RUNTIME)
    private readonly runtime: OpenAPIRuntimeService,
    @Inject(OPENAPI_VALIDATOR_OPTIONS)
    private readonly options: ValidatorOptions,
  ) {
    this.debugLog = DebugUtil.createDebugFn(this.logger, this.options.debug || false);

    if (this.options.ajv instanceof Ajv) {
      this.ajv = this.options.ajv;
    } else {
      this.ajv = new Ajv({
        allErrors: true,
        strict: 'log',
        ...this.options.requestValidation?.transform ? { coerceTypes: true, useDefaults: true } : {},
        ...this.options.ajv?.options,
      });
      this.options.ajv?.configure?.(this.ajv);
    }

    if (this.options.debug) {
      const { code: _code, uriResolver: _uriResolver, ...opts } = this.ajv.opts;
      this.debugLog(`AJV instance created with options:\n${JSON.stringify(opts, null, 2)}`);
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    this.openApiSpec = this.runtime.spec;
    this.registerComponentSchemas();
    if (this.options.precompileSchemas) await this.precompileSchemas();
  }

  private get isSpecLoaded(): boolean {
    return !!this.openApiSpec;
  }

  get validationOptions() {
    return this.options;
  }

  /**
   * Register all component schemas with AJV so it can resolve $ref references
   */
  private registerComponentSchemas(): void {
    if (!this.openApiSpec?.components) {
      this.debugLog('No components found to register');
      return;
    }

    const components = this.openApiSpec.components;

    // Register schemas
    if (components.schemas) {
      for (const [schemaName, schema] of Object.entries(components.schemas)) {
        try {
          this.ajv.addSchema(schema, `#/components/schemas/${schemaName}`);
          this.debugLog(`Registered component schema: ${schemaName}`);
        } catch (error) {
          this.logger.warn(`Failed to register component schema '${schemaName}':`, error);
        }
      }
    }

    // Register parameter schemas
    if (components.parameters) {
      for (const [paramName, param] of Object.entries(components.parameters)) {
        try {
          this.ajv.addSchema(param, `#/components/parameters/${paramName}`);
          this.debugLog(`Registered component parameter: ${paramName}`);
        } catch (error) {
          this.logger.warn(`Failed to register component parameter '${paramName}':`, error);
        }
      }
    }

    // Register request body schemas
    if (components.requestBodies) {
      for (const [requestBodyName, requestBody] of Object.entries(components.requestBodies)) {
        try {
          this.ajv.addSchema(requestBody, `#/components/requestBodies/${requestBodyName}`);
          this.debugLog(`Registered component request body: ${requestBodyName}`);
        } catch (error) {
          this.logger.warn(`Failed to register component request body '${requestBodyName}':`, error);
        }
      }
    }

    // Register response schemas
    if (components.responses) {
      for (const [responseName, response] of Object.entries(components.responses)) {
        try {
          this.ajv.addSchema(response, `#/components/responses/${responseName}`);
          this.debugLog(`Registered component response: ${responseName}`);
        } catch (error) {
          this.logger.warn(`Failed to register component response '${responseName}':`, error);
        }
      }
    }
  }

  /**
   * Walk the OpenAPI spec and eagerly compile all requestBody and parameter
   * schemas. This is triggered when `options.performance.precompileSchemas === true` and
   * eliminates runtime compilation overhead.
   */
  private async precompileSchemas(): Promise<void> {
    if (!this.openApiSpec || !this.openApiSpec.paths) return;

    let schemasCompiled = 0;
    const startTime = Date.now();

    for (const [routePath, pathItem] of Object.entries(this.openApiSpec.paths)) {
      for (const method of Object.keys(pathItem)) {
        if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'].includes(method.toLowerCase())) {
          continue;
        }

        const operation: any = (pathItem as any)[method];
        if (!operation) continue;
        const operationName = `${method.toUpperCase()} ${routePath}`;

        // Compile request body schema (if any)
        if (operation.requestBody) {
          const bodySchema = this.runtime.schemaResolver.extractBodySchema(operation.requestBody);
          if (bodySchema) {
            try {
              this.ajv.compile(bodySchema);
              schemasCompiled++;
              this.debugLog(`Precompiled schema "${operationName}" request body`);
            } catch (error) {
              this.logger.warn(`Failed to compile schema "${operationName}" request body`, error);
            }
          }
        }

        // Compile parameter schemas
        if (operation.parameters) {
          const parameterSchemas = this.runtime.schemaResolver.extractParameterSchemas(operation.parameters);
          ['path', 'query'].forEach(loc => {
            for (const p of (parameterSchemas as any)[loc] || []) {
              const sch = this.runtime.schemaResolver.resolveSchema(p.schema);
              if (sch) {
                try {
                  this.ajv.compile(this.getParameterSchema(sch));
                  schemasCompiled++;
                  this.debugLog(`Precompiled schema "${operationName}" request ${loc}`);
                } catch (error) {
                  this.logger.warn(`Failed to compile schema "${operationName}" request ${loc}`, error);
                }
              }
            }
          });
        }

        // Compile response schemas
        if (operation.responses) {
          for (const [statusCode] of Object.entries(operation.responses)) {
            const responseSchema = this.runtime.schemaResolver.extractResponseSchema(operation.responses, statusCode);
            if (responseSchema) {
              try {
                this.ajv.compile(responseSchema);
                schemasCompiled++;
                this.debugLog(`Precompiled schema "${operationName}" response "${statusCode}"`);
              } catch (error) {
                this.logger.warn(`Failed to compile schema "${operationName}" response "${statusCode}"`, error);
              }
            }
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    this.debugLog(`Precompiled ${schemasCompiled} schemas in ${duration}ms`);
  }

  private findOperation(method: string, path: string): any {
    if (!this.openApiSpec) return null;

    // convert Express.js route path to OpenAPI path format, e.g. /users/:id -> /users/{id}
    const openApiPath = path.replace(/:([^/]+)/g, '{$1}');

    const operation = this.openApiSpec.paths[openApiPath]?.[method.toLowerCase()];
    if (!operation) this.debugLog(`Found no operation for ${method} ${path}`);

    return operation;
  }

  private validateWithSchema(schema: any, data: any, type: 'path' | 'query' | 'body' | 'response'): ValidationError[] | null {
    const validator = this.ajv.compile(schema);

    if (!validator(data)) {
      const errors = validator.errors?.map((error) => ({
        validationType: type,
        ...error,
      }));

      if (errors?.length) {
        if (this.options.debug) this.debugLog(`Validation failed for "${type}"\n\nSchema:\n${JSON.stringify(schema, null, 2)}\n\nData:\n${JSON.stringify(data, null, 2)}\n\nErrors:\n${JSON.stringify(errors, null, 2)}`);
        return errors;
      };
    }

    if (this.options.debug) this.debugLog(`Validation passed for "${type}"\n\nSchema:\n${JSON.stringify(schema, null, 2)}\n\nData:\n${JSON.stringify(data, null, 2)}`);
    return null;
  }

  validateRequest(httpContext: HttpArgumentsHost, options: { body?: boolean; params?: boolean; query?: boolean } = { body: true, params: true, query: true }): ValidationError[] {
    if (!this.isSpecLoaded) return [];

    const validationOptions = options;

    // platform-agnostic extraction
    const requestData = PlatformUtil.extractRequestData(httpContext);
    const { method, path, body } = requestData;
    const { params, query } = requestData;

    if (!method || !path) return [];

    const operation = this.findOperation(method, path);
    if (!operation) return [];

    const errors: ValidationError[] = [];

    // Validate parameters if enabled
    if (operation.parameters) {
      const parameterSchemas = this.runtime.schemaResolver.extractParameterSchemas(operation.parameters);

      // Validate path parameters if enabled
      if (validationOptions.params && parameterSchemas.path.length > 0 && params) {
        const pathErrors = this.validateParameters(parameterSchemas.path, params, 'path');
        if (pathErrors.length) errors.push(...pathErrors);
      }

      // Validate query parameters if enabled
      if (validationOptions.query && parameterSchemas.query.length > 0 && query) {
        const queryErrors = this.validateParameters(parameterSchemas.query, query, 'query');
        if (queryErrors.length) errors.push(...queryErrors);
      }
    }

    // Validate request body if enabled
    if (validationOptions.body && operation.requestBody && body !== undefined) {
      const bodySchema = this.runtime.schemaResolver.extractBodySchema(operation.requestBody);
      if (bodySchema) {
        const bodyErrors = this.validateWithSchema(bodySchema, body, 'body');
        if (bodyErrors) errors.push(...bodyErrors);
      }
    }

    if (this.options.requestValidation?.transform) {
      PlatformUtil.setTransformedRequestData(httpContext, { body, params, query });
    }

    return errors;
  }

  private validateParameters(parameters: any[], data: any, type: 'path' | 'query'): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const param of parameters) {
      const value = data[param.name];
      const isRequired = param.required === true;

      if (
        isRequired &&
        (value === undefined || value === null || value === '')
      ) {
        this.debugLog(`Found missing required ${type} parameter: ${param.name}`);
        errors.push({
          validationType: type,
          keyword: 'required',
          instancePath: `/${param.name}`,
          schemaPath: `#/properties/${param.name}/required`,
          params: { missingProperty: param.name },
          message: `${param.name} is required`,
        });
        continue;
      }

      if (value !== undefined && param.schema) {
        const schema = this.runtime.schemaResolver.resolveSchema(param.schema);
        if (schema) {
          const paramValue = { value };
          const paramErrors = this.validateWithSchema(this.getParameterSchema(schema), paramValue, type);
          data[param.name] = paramValue.value; // to transform request data
          if (paramErrors) errors.push(...paramErrors);
        }
      }
    }

    return errors;
  }

  validateResponse(httpContext: HttpArgumentsHost, statusCode: number, responseBody: any): ValidationError[] {
    if (!this.isSpecLoaded) return [];

    // platform-agnostic extraction
    const requestData = PlatformUtil.extractRequestData(httpContext);
    const { method, path } = requestData;

    if (!method || !path) return [];

    const operation = this.findOperation(method, path);
    if (!operation) return [];

    if (!operation.responses) return [];

    const responseSchema = this.runtime.schemaResolver.extractResponseSchema(operation.responses, statusCode);

    if (responseSchema) {
      const responseErrors = this.validateWithSchema(
        responseSchema,
        responseBody,
        'response',
      );
      return responseErrors || [];
    }

    return [];
  }

  private getParameterSchema(schema: any) {
    return {
      type: "object",
      properties: {
        value: schema,
      },
      required: ["value"],
    };
  }
}
