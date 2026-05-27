import { Controller, Get, Sse, UseGuards } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { LogBusService, LogEvent } from './log-bus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SseJwtGuard } from '../auth/sse-jwt.guard';

@Controller('logs')
export class LogsController {
  constructor(private readonly logBus: LogBusService) {}

  @UseGuards(SseJwtGuard)
  @Sse('stream')
  streamLogs(): Observable<{ data: LogEvent }> {
    return this.logBus.stream$.pipe(
      map((event: LogEvent) => ({
        data: event,
      })),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('last')
  getLastLogs(): LogEvent[] {
    return this.logBus.getLastLogs(100);
  }
}
