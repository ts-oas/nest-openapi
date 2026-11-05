import type { ArgumentsHost } from '@nestjs/common';

export type HttpArgumentsHost = ReturnType<ArgumentsHost['switchToHttp']>;

/**
 * Platform-agnostic utility functions for extracting request data
 * Works with both Express and Fastify request objects
 */
export class PlatformUtil {
  static getMethod (request: any): string | null {
    return request.method?.toLowerCase() || null;
  }

  static getRoutePath (request: any): string | null {
    const baseUrl = (request.baseUrl || '').replace(/\/+$/, '');

    // Express: request.route?.path
    if (request.route?.path) {
      const routePath = request.route.path.startsWith('/') ? request.route.path : `/${request.route.path}`;
      const combined = `${baseUrl}${routePath}`.replace(/\/+/g, '/');
      return (combined.length > 1 && combined.endsWith('/')) ? combined.slice(0, -1) : combined;
    }

    // Fastify: request.routerPath or request.routeOptions?.url
    if (request.routerPath) {
      return request.routerPath;
    }

    if (request.routeOptions?.url) {
      return request.routeOptions.url;
    }

    // Fallback to request.path or request.url (stripping query string)
    const rawUrl = request.path || (typeof request.url === 'string' ? request.url.split('?')[0] : null);
    if (!rawUrl) return null;

    let path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    if (baseUrl && !path.startsWith(baseUrl)) {
      path = `${baseUrl}${path}`;
    }

    const normalized = path.replace(/\/+/g, '/');
    return (normalized.length > 1 && normalized.endsWith('/')) ? normalized.slice(0, -1) : normalized;
  }

  static getHeaders (request: any): Record<string, any> {
    // Express: request.headers
    if (request.headers) {
      return request.headers;
    }

    // Fastify: request.raw.headers
    if (request.raw?.headers) {
      return request.raw.headers;
    }

    return {};
  }

  static getHeader (request: any, key: string): any {
    const headers = this.getHeaders(request) || {};
    if (!key) return undefined;

    // Prefer exact match first
    if (key in headers) {
      return (headers as any)[key];
    }

    const lowerKey = key.toLowerCase();
    const directLower = (headers as any)[lowerKey];
    if (directLower !== undefined) {
      return directLower;
    }

    // Fallback: scan keys case‑insensitively
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === lowerKey) {
        return (headers as any)[k];
      }
    }

    return undefined;
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
