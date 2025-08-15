import { Logger } from '@nestjs/common';

export class DebugUtil {
  static debugLog(logger: Logger, enabled: boolean, message: string, ...args: any[]): void {
    if (enabled) {
      logger.debug(message, ...args);
    }
  }

  static createDebugFn(logger: Logger, enabled: boolean) {
    return (message: string, ...args: any[]) => {
      if (enabled) {
        logger.debug(message, ...args);
      }
    };
  }
}
