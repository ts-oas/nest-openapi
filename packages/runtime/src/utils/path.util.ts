import type { ExecutionContext } from "@nestjs/common";

export function getHttpDetails(ctx: ExecutionContext) {
  const http = ctx.switchToHttp();
  const req: any = http.getRequest();
  const res: any = http.getResponse();

  // Nest/Express
  const method: string = (req.method || "GET").toLowerCase();
  const rawPath: string = (req.route?.path || req.path || req.url || "/").split("?")[0];
  const baseUrl = req.baseUrl || "";
  const fullPath = (baseUrl + rawPath) || "/";

  return { req, res, method, rawPath: fullPath };
}

export function toOpenAPIPathPattern(nestPath: string) {
  // Express style ":id" -> OAS "{id}"; wildcard "*" -> ".*" for regex
  return nestPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

export function pathToRegex(oasPath: string) {
  // Convert OAS templated path to a safe regex
  const re = oasPath
    .replace(/[-/\\^$+?.()|[\]{}]/g, (m) => `\\${m}`)
    .replace(/\\\{[^}]+\\\}/g, "[^/]+");
  return new RegExp(`^${re}$`);
}

