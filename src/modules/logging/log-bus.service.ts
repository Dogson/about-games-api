import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface LogEvent {
  message: string;
  level: 'log' | 'error' | 'warn' | 'debug';
  context?: string;
  timestamp: number;
  trace?: string;
}

@Injectable()
export class LogBusService {
  private subject = new Subject<LogEvent>();

  stream$ = this.subject.asObservable();

  private readonly buffer: LogEvent[] = [];
  private readonly maxBufferSize = 100;

  emit(event: LogEvent) {
    // push into buffer
    this.buffer.push(event);

    // keep only last 100
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    this.subject.next(event);
  }

  getLastLogs(limit = 100): LogEvent[] {
    return this.buffer.slice(-limit);
  }
}
