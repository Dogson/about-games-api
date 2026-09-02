import { LogBusService } from './log-bus.service';

describe('LogBusService', () => {
  let logBus: LogBusService;

  beforeEach(() => {
    logBus = new LogBusService();
  });

  it('emits an event on the stream and buffers it', () => {
    const received: unknown[] = [];
    const subscription = logBus.stream$.subscribe((event) =>
      received.push(event),
    );

    const event = {
      message: 'hello',
      level: 'log' as const,
      timestamp: 123,
    };
    logBus.emit(event);

    expect(received).toEqual([event]);
    expect(logBus.getLastLogs()).toEqual([event]);

    subscription.unsubscribe();
  });

  it('keeps only the last 100 events in the buffer', () => {
    for (let i = 0; i < 105; i++) {
      logBus.emit({
        message: `event-${i}`,
        level: 'log',
        timestamp: i,
      });
    }

    const logs = logBus.getLastLogs();
    expect(logs).toHaveLength(100);
    expect(logs[0].message).toBe('event-5');
    expect(logs[logs.length - 1].message).toBe('event-104');
  });

  it('supports limiting the returned logs', () => {
    for (let i = 0; i < 10; i++) {
      logBus.emit({
        message: `event-${i}`,
        level: 'debug',
        timestamp: i,
      });
    }

    const logs = logBus.getLastLogs(3);
    expect(logs.map((log) => log.message)).toEqual([
      'event-7',
      'event-8',
      'event-9',
    ]);
  });
});
