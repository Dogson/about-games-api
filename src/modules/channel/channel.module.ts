import { Module } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { ChannelController } from './channel.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from '../game/entities/game.entity';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Video } from '../video/entities/video.entity';
import { Channel } from './entities/channel.entity';
import { YoutubeModule } from '../youtube/youtube.module';
import { VideoModule } from '../video/video.module';
import { createLoggerProvider } from '../logging/logger.provider';
import { LoggingModule } from '../logging/logging.module';

@Module({
  controllers: [ChannelController],
  providers: [ChannelService, createLoggerProvider(ChannelService.name)],
  imports: [
    SequelizeModule.forFeature([Game, VideosHasGames, Video, Channel]),
    YoutubeModule,
    VideoModule,
    LoggingModule,
  ],
  exports: [ChannelService],
})
export class ChannelModule {}
