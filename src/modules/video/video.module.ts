import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from '../game/entities/game.entity';
import { GamesHasCompanies } from '../../db/many-to-many/games-has-companies.table';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Company } from '../company/entities/company.entity';
import { Video } from './entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';

@Module({
  controllers: [VideoController],
  providers: [VideoService],
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
export class VideoModule {}
