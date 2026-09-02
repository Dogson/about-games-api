import { createLoggerProvider } from './logger.provider';
import { AppLogger } from './app-logger.service';
import { LogBusService } from './log-bus.service';

describe('createLoggerProvider', () => {
  it('builds an AppLogger bound to the given context', () => {
    const provider = createLoggerProvider('MyService');
    const logBus = new LogBusService();

    const logger = (
      provider as { useFactory: (bus: LogBusService) => AppLogger }
    ).useFactory(logBus);

    expect(logger).toBeInstanceOf(AppLogger);

    let emitted: unknown;
    const subscription = logBus.stream$.subscribe((event) => {
      emitted = event;
    });
    logger.log('hello');
    expect(emitted).toEqual(
      expect.objectContaining({ context: 'MyService', message: 'hello' }),
    );
    subscription.unsubscribe();
  });

  it('injects the log bus service', () => {
    const provider = createLoggerProvider('Svc');
    expect(provider).toEqual(
      expect.objectContaining({ provide: AppLogger, inject: [LogBusService] }),
    );
  });
});
