import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from './entities/game.entity';
import { GamesHasCompanies } from '../../db/many-to-many/games-has-companies.table';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Company } from '../company/entities/company.entity';
import { Video } from '../video/entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';

@Module({
  controllers: [GameController],
  providers: [GameService],
  imports: [
    SequelizeModule.forFeature([
      Game,
      GamesHasCompanies,
      VideosHasGames,
      Company,
      Video,
      Channel,
    ]),
  ],
})
export class GameModule {}
