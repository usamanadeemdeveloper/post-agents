import { Injectable, LoggerService, Scope } from "@nestjs/common";

/**
 * Thin wrapper around NestJS built-in logger.
 * Swap this for Winston/Pino later without touching any feature module.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context?: string;

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string): void {
    console.log(`[LOG] [${context ?? this.context}] ${message}`);
  }

  error(message: string, trace?: string, context?: string): void {
    console.error(
      `[ERROR] [${context ?? this.context}] ${message}`,
      trace ?? "",
    );
  }

  warn(message: string, context?: string): void {
    console.warn(`[WARN] [${context ?? this.context}] ${message}`);
  }

  debug(message: string, context?: string): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[DEBUG] [${context ?? this.context}] ${message}`);
    }
  }
}
