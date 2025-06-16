import { Module } from '@nestjs/common';
import { IgdbService } from './igdb.service';
import { GameModule } from '../game/game.module';

@Module({
  providers: [IgdbService],
  exports: [IgdbService],
  imports: [GameModule],
})
export class IgdbModule {}
