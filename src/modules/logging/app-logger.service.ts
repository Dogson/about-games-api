import { Injectable, Logger } from '@nestjs/common';
import { LogBusService, LogEvent } from './log-bus.service';

type LogLevel = LogEvent['level'];

@Injectable()
export class AppLogger extends Logger {
  constructor(
    private readonly logBus: LogBusService,
    context = 'App',
  ) {
    super(context);
  }

  log(message: unknown, trace?: unknown) {
    this.handle('log', message, trace);
    super.log(this.normalizeMessage(message));
  }

  error(message: unknown, trace?: unknown) {
    this.handle('error', message, trace);
    super.error(this.normalizeMessage(message), this.normalizeTrace(trace));
  }

  warn(message: unknown, trace?: unknown) {
    this.handle('warn', message, trace);
    super.warn(this.normalizeMessage(message));
  }

  debug(message: unknown, trace?: unknown) {
    this.handle('debug', message, trace);
    super.debug(this.normalizeMessage(message));
  }

  private handle(level: LogLevel, message: unknown, trace?: unknown) {
    this.logBus.emit({
      level,
      message: this.normalizeMessage(message),
      trace: this.normalizeTrace(trace),
      context: this.context,
      timestamp: Date.now(),
    });
  }

  private normalizeMessage(message: unknown): string {
    if (message instanceof Error) {
      return message.stack ?? message.message;
    }

    if (typeof message === 'string') {
      return message;
    }

    if (typeof message === 'object' && message !== null) {
      try {
        return JSON.stringify(message);
      } catch {
        return '[Unserializable object]';
      }
    }

    return String(message);
  }

  private normalizeTrace(trace: unknown): string | undefined {
    if (!trace) return undefined;

    if (trace instanceof Error) {
      return trace.stack ?? trace.message;
    }

    if (typeof trace === 'string') {
      return trace;
    }

    if (typeof trace === 'object') {
      try {
        return JSON.stringify(trace);
      } catch {
        return '[Unserializable trace object]';
      }
    }

    return this.normalizeMessage(trace);
  }
}
