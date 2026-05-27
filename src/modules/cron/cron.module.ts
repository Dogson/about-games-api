import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ChannelModule } from '../channel/channel.module';
import { GameModule } from '../game/game.module';
import { createLoggerProvider } from '../logging/logger.provider';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [ScheduleModule.forRoot(), ChannelModule, GameModule, LoggingModule],
  providers: [CronService, createLoggerProvider(CronService.name)],
})
export class CronModule {}
