import { Module } from '@nestjs/common';
import { DeepseekService } from './deepseek.service';
import { createLoggerProvider } from '../logging/logger.provider';
import { LoggingModule } from '../logging/logging.module';

@Module({
  providers: [DeepseekService, createLoggerProvider(DeepseekService.name)],
  exports: [DeepseekService],
  imports: [LoggingModule],
})
export class AiModule {}
