import { CallHandler, ExecutionContext, Inject, Injectable, InternalServerErrorException, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, map } from "rxjs";
import { OpenAPISerializerService } from "../services/openapi-serializer.service";
import { Reflector } from "@nestjs/core";
import { SERIALIZE_OVERRIDE, SerializeOverrideOptions } from "../decorators/serialize.decorator";
import { DebugUtil, PlatformUtil } from "@nest-openapi/runtime";

@Injectable()
export class ResponseSerializerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('OpenAPISerializer');
  private debugLog: (message: string, ...args: any[]) => void;
  constructor(
    @Inject(OpenAPISerializerService) private readonly serializer: OpenAPISerializerService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {
    this.debugLog = DebugUtil.createDebugFn(this.logger, this.serializer.options.debug || false);
  }

  intercept (context: ExecutionContext, next: CallHandler): Observable<any> {
    const override = this.reflector.get<SerializeOverrideOptions | { disable: true }>(
      SERIALIZE_OVERRIDE,
      context.getHandler(),
    );
    if (override?.["disable"]) return next.handle();

    return next.handle().pipe(
      map((body) => {

        const httpContext = context.switchToHttp();
        const statusCode = httpContext.getResponse().statusCode;
        try {
          const result = this.serializer.serializeResponse(
            context,
            statusCode,
            body,
            override?.["contentType"],
          );
          if (!result) return body; // pass through

          if ('error' in result) {
            this.debugLog(`Serialization error [${result.operationId}] ${statusCode}:`, result.error);
            const handler = this.serializer.options.responseSerialization?.onSerializationFailed;

            if (handler) handler({ context, operationId: result.operationId, statusCode, error: result.error });
            else this.defaultOnSerializationFailed(body, result.error);

            return body;
          }

          PlatformUtil.setHeader(httpContext, "content-type", result.contentType);

          return result.stringified;

        } catch (error) {
          this.debugLog(`Thrown error onSerializationFailed`, error);
          throw error;
        }
      }),
    );
  }

  private defaultOnSerializationFailed (data: any, error: string): void {
    this.logger.warn(`Response serialization failed:\nData: ${JSON.stringify(data)}\nError: ${error}`);
    throw new InternalServerErrorException({ message: 'Internal server error: Response serialization failed' });
  }
}
