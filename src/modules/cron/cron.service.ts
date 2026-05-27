import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChannelService } from '../channel/channel.service';
import { GameService } from '../game/game.service';

@Injectable()
export class CronService {
  constructor(
    private readonly channelService: ChannelService,
    private readonly gameService: GameService,
  ) {}

  private readonly logger = new Logger(CronService.name);

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleSyncAllChannels() {
    this.logger.log(
      'Running daily cron job to sync all youtube channels infos and remove unexisting videos',
    );
    void this.channelService.syncAllYoutubeChannels();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  handleGenerateMissingVideosCron() {
    this.logger.log(
      'Running daily cron job to generate missing videos for all channels',
    );
    void this.channelService.generateMissingVideosForAllChannels();
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  handleSyncAllGames() {
    this.logger.log(
      'Running monthly cron job to sync all games monthly with IGDB',
    );
    void this.gameService.syncAllGamesWithIgdb();
  }
}
