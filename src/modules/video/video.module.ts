import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from '../game/entities/game.entity';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Video } from './entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';
import { IgdbModule } from '../igdb/igdb.module';
import { GameModule } from '../game/game.module';

@Module({
  controllers: [VideoController],
  providers: [VideoService],
  imports: [
    SequelizeModule.forFeature([Game, VideosHasGames, Video, Channel]),
    IgdbModule,
    GameModule,
  ],
})
export class VideoModule {}
