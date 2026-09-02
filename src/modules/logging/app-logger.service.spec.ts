import { AppLogger } from './app-logger.service';
import { LogBusService, LogEvent } from './log-bus.service';

describe('AppLogger', () => {
  let logBus: LogBusService;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    logBus = new LogBusService();
    emitSpy = jest.spyOn(logBus, 'emit');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forwards a log event to the bus with context and timestamp', () => {
    const logger = new AppLogger(logBus, 'MyService');

    logger.log('something happened');

    const emitted = emitSpy.mock.calls[0][0] as LogEvent;
    expect(emitted.message).toBe('something happened');
    expect(emitted.level).toBe('log');
    expect(emitted.context).toBe('MyService');
    expect(typeof emitted.timestamp).toBe('number');
  });

  it('defaults the context to App', () => {
    const logger = new AppLogger(logBus);
    logger.warn('careful');
    const emitted = emitSpy.mock.calls[0][0] as LogEvent;
    expect(emitted.context).toBe('App');
  });

  it('emits error and debug levels', () => {
    const logger = new AppLogger(logBus, 'Svc');
    logger.error('boom');
    logger.debug('detail');

    expect((emitSpy.mock.calls[0][0] as LogEvent).level).toBe('error');
    expect((emitSpy.mock.calls[1][0] as LogEvent).level).toBe('debug');
  });

  it('uses the error stack when an Error is logged', () => {
    const logger = new AppLogger(logBus, 'Svc');
    const error = new Error('kaboom');

    logger.error(error);

    const emitted = emitSpy.mock.calls[0][0] as LogEvent;
    expect(emitted.message).toContain('Error: kaboom');
  });

  it('serializes plain objects', () => {
    const logger = new AppLogger(logBus, 'Svc');
    logger.log({ games: 3 });

    const emitted = emitSpy.mock.calls[0][0] as LogEvent;
    expect(emitted.message).toBe('{"games":3}');
  });

  it('falls back to a marker for unserializable objects', () => {
    const logger = new AppLogger(logBus, 'Svc');
    const circular: { self?: unknown } = {};
    circular.self = circular;

    logger.log(circular);

    const emitted = emitSpy.mock.calls[0][0] as LogEvent;
    expect(emitted.message).toBe('[Unserializable object]');
  });

  it('stringifies primitive non-strings', () => {
    const logger = new AppLogger(logBus, 'Svc');
    logger.log(42);

    const emitted = emitSpy.mock.calls[0][0] as LogEvent;
    expect(emitted.message).toBe('42');
  });

  it('omits the trace when none is provided and serializes it otherwise', () => {
    const logger = new AppLogger(logBus, 'Svc');

    logger.warn('no trace');
    expect((emitSpy.mock.calls[0][0] as LogEvent).trace).toBeUndefined();

    logger.warn('with trace', { step: 1 });
    const emitted = emitSpy.mock.calls[1][0] as LogEvent;
    expect(emitted.trace).toBe('{"step":1}');
  });

  it('normalizes an Error trace to its stack', () => {
    const logger = new AppLogger(logBus, 'Svc');
    const trace = new Error('trace me');

    logger.error('message', trace);

    const emitted = emitSpy.mock.calls[0][0] as LogEvent;
    expect(emitted.trace).toContain('Error: trace me');
  });
});
