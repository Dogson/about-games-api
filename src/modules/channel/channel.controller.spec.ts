import { Test, TestingModule } from '@nestjs/testing';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('ChannelController', () => {
  let controller: ChannelController;
  let channelService: jest.Mocked<ChannelService>;

  beforeEach(async () => {
    channelService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOneForApi: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      generateMissingVideosForAllChannels: jest.fn(),
      generateGamesForChannel: jest.fn(),
      syncAllYoutubeChannels: jest.fn(),
    } as unknown as jest.Mocked<ChannelService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChannelController],
      providers: [{ provide: ChannelService, useValue: channelService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(ChannelController);
  });

  it('delegates create and findAll', async () => {
    const dto = {
      youtubeHandle: 'my-channel',
      language: 'en',
      parsingOptions: { playlistsIds: ['PL1'] },
    };
    await controller.create(dto);
    expect(channelService.create).toHaveBeenCalledWith(dto);

    await controller.findAll();
    expect(channelService.findAll).toHaveBeenCalled();
  });

  it('resolves a channel for the API with a numeric id', async () => {
    await controller.findOne('4');
    expect(channelService.findOneForApi).toHaveBeenCalledWith(4);
  });

  it('delegates update and remove with a numeric id', async () => {
    await controller.update('4', { language: 'fr' });
    expect(channelService.update).toHaveBeenCalledWith(4, { language: 'fr' });

    await controller.remove('4');
    expect(channelService.remove).toHaveBeenCalledWith(4);
  });

  it('acknowledges the fire-and-forget video generation', async () => {
    const result = controller.generateMissingVideosForAllChannels();
    expect(
      channelService.generateMissingVideosForAllChannels,
    ).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Video generation started',
    });
  });

  it('generates games for a single numeric channel id', async () => {
    channelService.generateGamesForChannel.mockResolvedValue({
      success: true,
      message: 'Game generation started',
      updated: 2,
    });

    await expect(controller.generateGamesForChannel('4')).resolves.toEqual({
      success: true,
      message: 'Game generation started',
      updated: 2,
    });
    expect(channelService.generateGamesForChannel).toHaveBeenCalledWith(4);
  });

  it('kicks the full YouTube sync', async () => {
    await controller.removeRemovedFromYoutube();
    expect(channelService.syncAllYoutubeChannels).toHaveBeenCalled();
  });
});
