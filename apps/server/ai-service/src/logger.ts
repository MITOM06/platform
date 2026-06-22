import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { redactPii, REDACT_ALL } from './common/pii-redactor';

/**
 * Emits structured JSON logs when NODE_ENV=production so GCP Cloud Logging
 * can parse and index each field. Falls back to the default NestJS format in dev.
 *
 * All string log messages are PII/secret-redacted before they are written, so
 * emails, phone numbers, card numbers and API keys never land in log storage.
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
    const safeMessage = typeof message === 'string' ? redactPii(message, REDACT_ALL) : message;
    if (!this.isProd) {
      return super.formatMessage(
        logLevel,
        safeMessage,
        pidMessage,
        formattedLogLevel,
        contextMessage,
        timestampDiff,
      );
    }
    const entry = {
      severity: logLevel.toUpperCase(),
      message: safeMessage,
      context: contextMessage.replace(/[\[\]]/g, '').trim() || undefined,
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(entry) + '\n';
  }
}
