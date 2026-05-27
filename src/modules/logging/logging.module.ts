import { Module } from '@nestjs/common';
import { LogBusService } from './log-bus.service';
import { LogsController } from './logging.controller';

@Module({
  providers: [LogBusService],
  exports: [LogBusService],
  controllers: [LogsController],
})
export class LoggingModule {}
