import { forwardRef, Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Game } from './entities/game.entity';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { Video } from '../video/entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';
import { IgdbModule } from '../igdb/igdb.module';
import { AiModule } from '../ai/ai.module';
import { createLoggerProvider } from '../logging/logger.provider';
import { LoggingModule } from '../logging/logging.module';

@Module({
  controllers: [GameController],
  providers: [GameService, createLoggerProvider(GameService.name)],
  exports: [GameService],
  imports: [
    SequelizeModule.forFeature([Game, VideosHasGames, Video, Channel]),
    forwardRef(() => IgdbModule),
    AiModule,
    LoggingModule,
  ],
})
export class GameModule {}
