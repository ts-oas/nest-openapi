import { ExecutionContext, Inject, Injectable, Logger } from "@nestjs/common";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { PlatformUtil } from "@nest-openapi/runtime";
import { OPENAPI_MOCK_OPTIONS, OpenAPIMockOptions } from "../types/mock-options.interface";

@Injectable()
export class RecordingStoreService {
  private readonly logger = new Logger("OpenAPIMock");
  constructor(@Inject(OPENAPI_MOCK_OPTIONS) private readonly options: OpenAPIMockOptions) {}

  async load(ctx: ExecutionContext, input: { operationKey: string; status: number; mediaType: string | undefined }): Promise<{ status: number; headers?: Record<string, string>; body: any; mediaType?: string } | null> {
    const recording = this.options.recording;
    if (!recording?.dir) return null;

    const key = await this.computeKey(ctx, input.operationKey, !!recording.matchBody, recording.redact || []);
    const dirPath = path.join(recording.dir, this.safeDir(input.operationKey));
    const fileName = this.buildFileName(input.status, input.mediaType, key.hash);
    const filePath = path.join(dirPath, fileName);

    try {
      const data = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(data);
      const body = this.deserializeBody(parsed.response);
      return { status: parsed.response.status, headers: parsed.response.headers, body, mediaType: parsed.response.mediaType };
    } catch (error: any) {
      this.logger.debug(`Failed to load recording: ${error?.message || error}`);
      return null;
    }
  }

  async save(ctx: ExecutionContext, input: { operationKey: string; status: number; mediaType: string | undefined; headers?: Record<string, string>; body: any }): Promise<void> {
    const recording = this.options.recording;
    if (!recording?.dir) return;

    const key = await this.computeKey(ctx, input.operationKey, !!recording.matchBody, recording.redact || []);
    const dirPath = path.join(recording.dir, this.safeDir(input.operationKey));
    const fileName = this.buildFileName(input.status, input.mediaType, key.hash);
    const filePath = path.join(dirPath, fileName);

    const payload = {
      request: key.request,
      response: this.serializeBody({ status: input.status, headers: input.headers || {}, mediaType: input.mediaType, body: input.body }),
      meta: { createdAt: new Date().toISOString(), version: 1 },
    };

    try {
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
    } catch (e: any) {
      this.logger.warn(`Failed to save recording: ${e?.message || e}`);
    }
  }

  private async computeKey(ctx: ExecutionContext, operationKey: string, matchBody: boolean, redact: string[]) {
    const http = ctx.switchToHttp();
    const req: any = http.getRequest();

    const method: string = String(PlatformUtil.getMethod(req) || "GET").toUpperCase();
    const rawPath = PlatformUtil.getRoutePath(req) || "/";
    const urlPath: string = String((rawPath || "/").split("?")[0] || "/");
    const query = PlatformUtil.getQuery(req) || {};
    const headers = this.filteredHeaders(PlatformUtil.getHeaders(req), redact);

    let bodyHash: string | undefined;
    if (matchBody) {
      const rawBody = this.readBodySync(req);
      bodyHash = this.hashObject(rawBody ?? null);
    }

    const matchTuple = { operationKey, method, urlPath, query, headers, bodyHash };
    const hash = this.hashObject(matchTuple).slice(0, 12);

    return {
      hash,
      request: { method, operationKey, urlPath, query, headers, bodyHash },
    };
  }

  private filteredHeaders(h: Record<string, any>, redact: string[]): Record<string, any> {
    const lower = new Set((redact || []).map((x) => String(x).toLowerCase()));
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(h || {})) {
      const key = k.toLowerCase();
      if (lower.has(key)) continue;
      out[key] = v;
    }
    return out;
  }

  private serializeBody(input: { status: number; headers: Record<string, string>; mediaType?: string; body: any }) {
    const mediaType = input.mediaType || this.inferMediaType(input.headers);
    if (Buffer.isBuffer(input.body)) {
      return { status: input.status, headers: input.headers, mediaType, bodyType: "base64", body: input.body.toString("base64") };
    }
    if (mediaType && (mediaType.startsWith("text/") || mediaType.includes("xml"))) {
      return { status: input.status, headers: input.headers, mediaType, bodyType: "text", body: String(input.body ?? "") };
    }
    if (mediaType && mediaType.startsWith("application/json")) {
      return { status: input.status, headers: input.headers, mediaType, bodyType: "json", body: input.body };
    }
    // default: try JSON, fallback to text
    const bodyIsObject = input && typeof input.body === "object" && input.body !== null;
    return { status: input.status, headers: input.headers, mediaType: mediaType || "application/json", bodyType: bodyIsObject ? "json" : "text", body: bodyIsObject ? input.body : String(input.body ?? "") };
  }

  private deserializeBody(rec: any) {
    if (!rec) return undefined;
    if (rec.bodyType === "base64") return Buffer.from(String(rec.body || ""), "base64");
    return rec.body;
  }

  private inferMediaType(headers: Record<string, string>): string | undefined {
    const ct = headers?.["content-type"] || headers?.["Content-Type"] as any;
    return ct as any;
  }

  private buildFileName(status: number, mediaType: string | undefined, hash: string) {
    const mediaSlug = (mediaType || "application/json").replace(/[^a-zA-Z0-9]+/g, "-");
    return `${status}_${mediaSlug}_${hash}.json`;
  }

  private safeDir(operationKey: string) {
    // Convert operation key like "GET /books/{id}" to "GET_books_{id}"
    // Replace spaces and slashes with underscores, keep alphanumeric, dashes, underscores, and braces
    return operationKey
      .replace(/\s+/g, "_")
      .replace(/\//g, "_")
      .replace(/[^a-zA-Z0-9_\-{}]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  private hashObject(obj: any): string {
    const json = JSON.stringify(obj, Object.keys(obj || {}).sort());
    return crypto.createHash("sha256").update(json).digest("hex");
  }

  private readBodySync(req: any): any {
    // Attempt to read parsed body if available (Express/Nest typically has it on req.body)
    return req?.body;
  }
}

