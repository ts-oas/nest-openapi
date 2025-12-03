import { CallHandler, ExecutionContext, Inject, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Reflector } from "@nestjs/core";
import { OpenAPIMockService } from "../services/openapi-mock.service";
import { RecordingStoreService } from "../services/recording-store.service";
import { PlatformUtil } from "@nest-openapi/runtime";
import { MOCK_OVERRIDE } from "../decorators/openapi-mock.decorator";
import type { OperationMockOptions } from "../types/mock-options.interface";

@Injectable()
export class OpenAPIMockInterceptor implements NestInterceptor {
  private readonly logger = new Logger("OpenAPIMock");
  constructor(
    @Inject(OpenAPIMockService) private readonly mock: OpenAPIMockService,
    @Inject(RecordingStoreService) private readonly recording: RecordingStoreService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const override = this.reflector.get<OperationMockOptions>(
      MOCK_OVERRIDE,
      context.getHandler(),
    );

    const plan = this.mock.tryPlan(context, override);
    const http = context.switchToHttp();
    const res: any = http.getResponse();

    // If no plan (route not in spec or mocking disabled), check for capture
    if (!plan) {
      const shouldCapture = this.shouldCapture(context, override);
      if (shouldCapture) {
        return next.handle().pipe(
          tap(async (responseBody) => {
            await this.captureResponse(context, res, responseBody);
          }),
        );
      }
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.mock.generate(context, plan)
        .then(async (result) => {
          if (!result) {
            // Route is not mocked - check if we should capture real response
            const shouldCapture = this.shouldCapture(context, override);

            if (shouldCapture) {
              // Capture real response using tap operator
              next.handle().pipe(
                tap(async (responseBody) => {
                  await this.captureResponse(context, res, responseBody);
                }),
              ).subscribe({
                next: (v) => subscriber.next(v),
                error: (e) => subscriber.error(e),
                complete: () => subscriber.complete(),
              });
              return;
            } else {
              // Just pass through without capturing
              next.handle().subscribe({
                next: (v) => subscriber.next(v),
                error: (e) => subscriber.error(e),
                complete: () => subscriber.complete(),
              });
              return;
            }
          }

          if (plan.delayMs) {
            const delay = typeof plan.delayMs === "function" ? (plan.delayMs as any)(context) : plan.delayMs;
            if (delay && delay > 0) await new Promise((r) => setTimeout(r, delay));
          }

          res.status(result.status);
          if (result.headers) {
            for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v as any);
          }
          if (result.mediaType) res.type?.(result.mediaType);

          subscriber.next(result.body);
          subscriber.complete();
        })
        .catch((err) => {
          this.logger.warn(`Mock generation failed: ${err?.message || err}`);
          next.handle().subscribe({
            next: (v) => subscriber.next(v),
            error: (e) => subscriber.error(e),
            complete: () => subscriber.complete(),
          });
        });
    });
  }

  private shouldCapture(context: ExecutionContext, override?: OperationMockOptions): boolean {
    // Check decorator override first
    if (override?.recording?.capture !== undefined) {
      return override.recording.capture;
    }

    // Fall back to global config
    const globalRecording = this.mock.options.recording;
    return globalRecording?.capture === true;
  }

  private async captureResponse(context: ExecutionContext, res: any, body: any): Promise<void> {
    try {
      // Try to get operation key from spec first
      let operationKey = this.mock.getOperationKey(context);

      // If not in spec, construct from request
      if (!operationKey) {
        const http = context.switchToHttp();
        const req: any = http.getRequest();
        const method = PlatformUtil.getMethod(req) || "GET";
        const routePath = PlatformUtil.getRoutePath(req) || req.path || "/";
        operationKey = `${method.toUpperCase()} ${routePath}`;
      }

      const status = res.statusCode || 200;
      const headers: Record<string, string> = {};

      // Extract headers from response
      if (res.getHeaders) {
        const rawHeaders = res.getHeaders();
        for (const [k, v] of Object.entries(rawHeaders || {})) {
          if (v !== undefined) headers[k] = String(v);
        }
      }

      const contentType = headers['content-type'] || headers['Content-Type'] || 'application/json';
      const mediaType = contentType.split(';')[0].trim();

      await this.recording.save(context, {
        operationKey,
        status,
        mediaType,
        headers,
        body,
      });
    } catch (error: any) {
      this.logger.warn(`Failed to capture response: ${error?.message || error}`);
    }
  }
}

