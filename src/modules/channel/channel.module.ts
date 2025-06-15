import { Module } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { ChannelController } from './channel.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from '../game/entities/game.entity';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Video } from '../video/entities/video.entity';
import { Channel } from './entities/channel.entity';
import { YoutubeModule } from '../youtube/youtube.module';

@Module({
  controllers: [ChannelController],
  providers: [ChannelService],
  imports: [
    SequelizeModule.forFeature([Game, VideosHasGames, Video, Channel]),
    YoutubeModule,
  ],
})
export class ChannelModule {}
