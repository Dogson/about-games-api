import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChannelService } from '../channel/channel.service';
import { GameService } from '../game/game.service';
import { AppLogger } from '../logging/app-logger.service';

@Injectable()
export class CronService {
  constructor(
    private readonly channelService: ChannelService,
    private readonly gameService: GameService,
    private readonly appLogger: AppLogger,
  ) {}

  private readonly logger = new Logger(CronService.name);

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleSyncAllChannels() {
    this.appLogger.log(
      'Running daily cron job to sync all youtube channels infos and remove unexisting videos',
    );
    void this.channelService.syncAllYoutubeChannels();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  handleGenerateMissingVideosCron() {
    this.appLogger.log(
      'Running daily cron job to generate missing videos for all channels',
    );
    void this.channelService.generateMissingVideosForAllChannels();
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  handleSyncAllGames() {
    this.appLogger.log(
      'Running monthly cron job to sync all games monthly with IGDB',
    );
    void this.gameService.syncAllGamesWithIgdb();
  }
}
