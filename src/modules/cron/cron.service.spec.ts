import { CronService } from './cron.service';
import { ChannelService } from '../channel/channel.service';
import { GameService } from '../game/game.service';
import { AppLogger } from '../logging/app-logger.service';
import { createAppLoggerMock } from 'src/testing/logger-stub';
import { cast } from 'src/testing/cast';

describe('CronService', () => {
  let channelService: jest.Mocked<
    Pick<
      ChannelService,
      'syncAllYoutubeChannels' | 'generateMissingVideosForAllChannels'
    >
  >;
  let gameService: jest.Mocked<Pick<GameService, 'syncAllGamesWithIgdb'>>;
  let appLogger: ReturnType<typeof createAppLoggerMock>;
  let service: CronService;

  beforeEach(() => {
    channelService = {
      syncAllYoutubeChannels: jest.fn().mockResolvedValue(undefined),
      generateMissingVideosForAllChannels: jest
        .fn()
        .mockResolvedValue(undefined),
    } as unknown as jest.Mocked<
      Pick<
        ChannelService,
        'syncAllYoutubeChannels' | 'generateMissingVideosForAllChannels'
      >
    >;
    gameService = {
      syncAllGamesWithIgdb: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Pick<GameService, 'syncAllGamesWithIgdb'>>;
    appLogger = createAppLoggerMock();
    service = new CronService(
      cast<ChannelService>(channelService),
      cast<GameService>(gameService),
      cast<AppLogger>(appLogger),
    );
  });

  it('kicks off the nightly channel sync', () => {
    service.handleSyncAllChannels();

    expect(channelService.syncAllYoutubeChannels).toHaveBeenCalled();
    expect(appLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('sync all youtube channels'),
    );
  });

  it('kicks off the missing-videos generation job', () => {
    service.handleGenerateMissingVideosCron();

    expect(
      channelService.generateMissingVideosForAllChannels,
    ).toHaveBeenCalled();
  });

  it('kicks off the monthly IGDB game sync', () => {
    service.handleSyncAllGames();

    expect(gameService.syncAllGamesWithIgdb).toHaveBeenCalled();
  });
});
