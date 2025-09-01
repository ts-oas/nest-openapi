import { HttpArgumentsHost } from '@nestjs/common/interfaces';

/**
 * Platform-agnostic utility functions for extracting request data
 * Works with both Express and Fastify request objects
 */
export class PlatformUtil {
  static getMethod (request: any): string | null {
    return request.method?.toLowerCase() || null;
  }

  static getRoutePath (request: any): string | null {
    // Express: request.route?.path
    if (request.route?.path) {
      return request.route.path;
    }

    // Fastify: request.routerPath or request.routeOptions?.url
    if (request.routerPath) {
      return request.routerPath;
    }

    if (request.routeOptions?.url) {
      return request.routeOptions.url;
    }

    // Fallback to request.path or request.url
    return request.path || request.url || null;
  }

  static getBody (request: any): any {
    return request.body;
  }

  static getParams (request: any): any {
    return request.params || {};
  }

  static getQuery (request: any): any {
    return request.query || {};
  }

  static extractRequestData (httpContext: HttpArgumentsHost) {
    const request = httpContext.getRequest();

    return {
      method: this.getMethod(request),
      path: this.getRoutePath(request),
      body: this.getBody(request),
      params: this.getParams(request),
      query: this.getQuery(request),
    };
  }

  static setTransformedRequestData (httpContext: HttpArgumentsHost, data: { body: any; params: any; query: any }) {
    const request = httpContext.getRequest();

    if (data.body) request.body = data.body;
    if (data.params) request.params = data.params;

    // express request.query is not writable, so we need to set it manually
    if (data.query) {
      const newQuery = data.query;
      Object.defineProperty(request, 'query', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: newQuery,
      });
    }
  }

  static setHeader (httpContext: HttpArgumentsHost, key: string, value: string) {
    const response = httpContext.getResponse();

    // Express: response.setHeader
    if (response.setHeader) {
      response.setHeader(key, value);
    }

    // Fastify: response.headers
    if (response.headers) {
      response.headers[key] = value;
    }
  }
}
