import { Test, TestingModule } from '@nestjs/testing';
import { LogsController } from './logging.controller';
import { LogBusService } from './log-bus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SseJwtGuard } from '../auth/sse-jwt.guard';

describe('LogsController', () => {
  let controller: LogsController;
  let logBus: LogBusService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [LogBusService],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SseJwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(LogsController);
    logBus = moduleRef.get(LogBusService);
  });

  it('returns the buffered last logs', () => {
    logBus.emit({
      message: 'a',
      level: 'log',
      context: 'svc',
      timestamp: 1,
    });
    logBus.emit({
      message: 'b',
      level: 'error',
      context: 'svc',
      timestamp: 2,
    });

    expect(controller.getLastLogs()).toHaveLength(2);
  });

  it('streams new log events wrapped in a data envelope', async () => {
    const values: unknown[] = [];
    const subscription = controller.streamLogs().subscribe((value) => {
      values.push(value);
    });

    logBus.emit({
      message: 'streamed',
      level: 'debug',
      context: 'svc',
      timestamp: 5,
    });

    expect(values).toEqual([
      {
        data: {
          message: 'streamed',
          level: 'debug',
          context: 'svc',
          timestamp: 5,
        },
      },
    ]);

    subscription.unsubscribe();
  });
});
