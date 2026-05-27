import { Module } from '@nestjs/common';
import { IgdbService } from './igdb.service';
import { GameModule } from '../game/game.module';
import { createLoggerProvider } from '../logging/logger.provider';
import { LoggingModule } from '../logging/logging.module';

@Module({
  providers: [IgdbService, createLoggerProvider(IgdbService.name)],
  exports: [IgdbService],
  imports: [GameModule, LoggingModule],
})
export class IgdbModule {}
