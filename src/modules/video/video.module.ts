import { forwardRef, Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from '../game/entities/game.entity';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Video } from './entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';
import { IgdbModule } from '../igdb/igdb.module';
import { GameModule } from '../game/game.module';
import { ChannelModule } from '../channel/channel.module';
import { YoutubeModule } from '../youtube/youtube.module';
import { createLoggerProvider } from '../logging/logger.provider';
import { LoggingModule } from '../logging/logging.module';

@Module({
  controllers: [VideoController],
  providers: [VideoService, createLoggerProvider(VideoService.name)],
  imports: [
    SequelizeModule.forFeature([Game, VideosHasGames, Video, Channel]),
    IgdbModule,
    GameModule,
    YoutubeModule,
    forwardRef(() => ChannelModule),
    LoggingModule,
  ],
  exports: [VideoService],
})
export class VideoModule {}
