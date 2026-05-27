import { Provider } from '@nestjs/common';
import { LogBusService } from './log-bus.service';
import { AppLogger } from './app-logger.service';

export const createLoggerProvider = (context: string): Provider => ({
  provide: AppLogger,
  useFactory: (logBus: LogBusService) => {
    return new AppLogger(logBus, context);
  },
  inject: [LogBusService],
});
