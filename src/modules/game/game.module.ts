import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from './entities/game.entity';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Video } from '../video/entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';

@Module({
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
  imports: [SequelizeModule.forFeature([Game, VideosHasGames, Video, Channel])],
})
export class GameModule {}
