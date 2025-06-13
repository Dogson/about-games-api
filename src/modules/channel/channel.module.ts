import { Module } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { ChannelController } from './channel.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from '../game/entities/game.entity';
import { GamesHasCompanies } from '../../db/many-to-many/games-has-companies.table';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Company } from '../company/entities/company.entity';
import { Video } from '../video/entities/video.entity';
import { Channel } from './entities/channel.entity';

@Module({
  controllers: [ChannelController],
  providers: [ChannelService],
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
export class ChannelModule {}
