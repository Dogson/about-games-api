import { Module } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { ChannelController } from './channel.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from '../game/entities/game.entity';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Video } from '../video/entities/video.entity';
import { Channel } from './entities/channel.entity';

@Module({
  controllers: [ChannelController],
  providers: [ChannelService],
  imports: [SequelizeModule.forFeature([Game, VideosHasGames, Video, Channel])],
})
export class ChannelModule {}
