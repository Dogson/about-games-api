import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ChannelModule } from '../channel/channel.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [ScheduleModule.forRoot(), ChannelModule, GameModule],
  providers: [CronService],
})
export class CronModule {}
