import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * Emits structured JSON logs when NODE_ENV=production so GCP Cloud Logging
 * can parse and index each field. Falls back to the default NestJS format in dev.
 */
export class JsonLogger extends ConsoleLogger {
  private readonly isProd = process.env.NODE_ENV === 'production';

  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    if (!this.isProd) {
      return super.formatMessage(
        logLevel,
        message,
        pidMessage,
        formattedLogLevel,
        contextMessage,
        timestampDiff,
      );
    }
    const entry = {
      severity: logLevel.toUpperCase(),
      message,
      context: contextMessage.replace(/[\[\]]/g, '').trim() || undefined,
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(entry) + '\n';
  }
}
