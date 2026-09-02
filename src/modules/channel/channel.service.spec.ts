import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { createModelMock } from 'src/testing/model-mock';
import { createAppLoggerMock } from 'src/testing/logger-stub';
import { flushMicrotasks } from 'src/testing/flush-promises';
import { cast } from 'src/testing/cast';
import { Channel } from './entities/channel.entity';
import { Video } from '../video/entities/video.entity';
import { YoutubeService } from '../youtube/youtube.service';
import { VideoService } from '../video/video.service';
import { AppLogger } from '../logging/app-logger.service';
import type { CreateChannelDto } from './dto/create-channel.dto';
import type { ChannelResponseDto } from './dto/channel-response.dto';
import { Op } from 'sequelize';

function channelInstance(fields: Record<string, unknown>): Channel {
  return cast<Channel>({
    id: fields.id,
    ...fields,
    get: (keyOrOptions: unknown): unknown => {
      if (typeof keyOrOptions === 'string') {
        return fields[keyOrOptions];
      }
      return fields;
    },
  });
}

function videoInstance(fields: Record<string, unknown>): Video {
  return cast<Video>({
    id: fields.id,
    ...fields,
    get: (keyOrOptions: unknown): unknown => {
      if (typeof keyOrOptions === 'string') {
        return fields[keyOrOptions];
      }
      return fields;
    },
  });
}

const baseChannelFields = {
  id: 3,
  name: 'My Channel',
  youtubeHandle: 'my-channel',
  youtubeId: 'UC',
  youtubeUploadsId: 'UU',
  description: 'desc',
  thumbnailUrl: 'thumb.png',
  language: 'en',
  ignoreEpisodesContaining: [] as string[],
  playlistsIds: ['PL1'] as string[],
  additionalGameCandidateAIPrompt: undefined as string | undefined,
  videosCount: 4,
};

describe('ChannelService', () => {
  let channelModel: ReturnType<typeof createModelMock>;
  let videoModel: ReturnType<typeof createModelMock>;
  let youtubeService: jest.Mocked<
    Pick<
      YoutubeService,
      | 'getYtChannelInfosByHandle'
      | 'getYtChannelInfosById'
      | 'getAllVideosFromPlaylists'
      | 'isYoutubeShort'
    >
  >;
  let videoService: jest.Mocked<
    Pick<
      VideoService,
      | 'create'
      | 'syncVideosFromYoutube'
      | 'purgeShortsFromChannel'
      | 'regenerateGamesForVideo'
    >
  >;
  let appLogger: ReturnType<typeof createAppLoggerMock>;
  let service: ChannelService;

  beforeEach(() => {
    channelModel = createModelMock();
    videoModel = createModelMock();
    youtubeService = {
      getYtChannelInfosByHandle: jest.fn(),
      getYtChannelInfosById: jest.fn(),
      getAllVideosFromPlaylists: jest.fn(),
      isYoutubeShort: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<
        YoutubeService,
        | 'getYtChannelInfosByHandle'
        | 'getYtChannelInfosById'
        | 'getAllVideosFromPlaylists'
        | 'isYoutubeShort'
      >
    >;
    videoService = {
      create: jest.fn(),
      syncVideosFromYoutube: jest.fn(),
      purgeShortsFromChannel: jest.fn(),
      regenerateGamesForVideo: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<
        VideoService,
        | 'create'
        | 'syncVideosFromYoutube'
        | 'purgeShortsFromChannel'
        | 'regenerateGamesForVideo'
      >
    >;
    appLogger = createAppLoggerMock();

    service = new ChannelService(
      cast<typeof Channel>(channelModel),
      cast<typeof Video>(videoModel),
      cast<YoutubeService>(youtubeService),
      cast<VideoService>(videoService),
      cast<AppLogger>(appLogger),
    );
  });

  describe('create', () => {
    it('rejects a channel whose YouTube handle already exists', async () => {
      channelModel.findOne.mockResolvedValue(
        channelInstance(baseChannelFields),
      );

      const dto: CreateChannelDto = {
        youtubeHandle: 'my-channel',
        language: 'en',
        parsingOptions: { playlistsIds: ['PL1'] },
      };

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(youtubeService.getYtChannelInfosByHandle).not.toHaveBeenCalled();
    });

    it('creates the channel from YouTube infos and flattens parsing options', async () => {
      channelModel.findOne.mockResolvedValue(null);
      youtubeService.getYtChannelInfosByHandle.mockResolvedValue(
        cast<never>({
          id: 'UC',
          snippet: {
            title: 'My Channel',
            description: 'desc',
            thumbnails: { default: { url: 'thumb.png' } },
          },
          contentDetails: { relatedPlaylists: { uploads: 'UU' } },
        }),
      );
      const created = channelInstance({
        id: 3,
        youtubeHandle: 'my-channel',
        language: 'en',
        playlistsIds: ['PL1'],
      });
      channelModel.create.mockResolvedValue(created);
      channelModel.findByPk.mockResolvedValue(
        channelInstance({
          ...baseChannelFields,
          ignoreEpisodesContaining: ['(1)'],
          videosCount: 7,
        }),
      );
      youtubeService.getAllVideosFromPlaylists.mockResolvedValue([]);

      const dto: CreateChannelDto = {
        youtubeHandle: 'my-channel',
        language: 'en',
        parsingOptions: {
          ignoreEpisodesContaining: ['(1)'],
          playlistsIds: ['PL1'],
        },
      };

      const result = await service.create(dto);

      expect(channelModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeHandle: 'my-channel',
          language: 'en',
          ignoreEpisodesContaining: ['(1)'],
          playlistsIds: ['PL1'],
          youtubeId: 'UC',
          name: 'My Channel',
          description: 'desc',
          thumbnailUrl: 'thumb.png',
          youtubeUploadsId: 'UU',
        }),
      );
      await flushMicrotasks();
      expect(youtubeService.getAllVideosFromPlaylists).toHaveBeenCalledWith([
        'PL1',
      ]);

      const response: ChannelResponseDto = result;
      expect(response.id).toBe(3);
      expect(response.parsingOptions).toEqual({
        ignoreEpisodesContaining: ['(1)'],
        playlistsIds: ['PL1'],
      });
      expect(response.videosCount).toBe(7);
      expect(response.videos).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('transforms every channel and exposes videosCount', async () => {
      channelModel.findAll.mockResolvedValue([
        channelInstance({ ...baseChannelFields, playlistsIds: ['PL1'] }),
      ]);

      const result = await service.findAll();

      expect(channelModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ group: ['Channel.id'] }),
      );
      expect(result[0].parsingOptions).toEqual({
        ignoreEpisodesContaining: [],
        playlistsIds: ['PL1'],
      });
      expect(result[0].videosCount).toBe(4);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the channel is missing', async () => {
      channelModel.findByPk.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the raw channel', async () => {
      const found = channelInstance(baseChannelFields);
      channelModel.findByPk.mockResolvedValue(found);
      await expect(service.findOne(1)).resolves.toBe(found);
    });
  });

  describe('findOneForApi', () => {
    it('throws NotFoundException when the channel is missing', async () => {
      channelModel.findByPk.mockResolvedValue(null);
      await expect(service.findOneForApi(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the transformed channel with its videos', async () => {
      const found = channelInstance({
        ...baseChannelFields,
        videos: [videoInstance({ id: 1, title: 'V' })],
      });
      channelModel.findByPk.mockResolvedValue(found);

      const result = await service.findOneForApi(1);

      expect(channelModel.findByPk).toHaveBeenCalledWith(1, {
        include: [{ model: Video }],
      });
      expect(result.videos).toHaveLength(1);
    });
  });

  describe('update', () => {
    function commonMocks(): Channel {
      const existing = channelInstance({
        ...baseChannelFields,
        ignoreEpisodesContaining: ['(part 1)'],
        playlistsIds: ['PL1'],
        videosCount: 2,
      });
      channelModel.findByPk.mockResolvedValue(existing);
      return existing;
    }

    it('throws NotFoundException when the channel is missing', async () => {
      channelModel.findByPk.mockResolvedValue(null);
      await expect(
        service.update(1, { language: 'fr' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('erases all videos and refetches when playlists changed', async () => {
      const existing = commonMocks();
      youtubeService.getAllVideosFromPlaylists.mockResolvedValue([]);

      const result = await service.update(1, {
        parsingOptions: { playlistsIds: ['PL2'] },
      });
      await flushMicrotasks();

      expect(channelModel.update).toHaveBeenCalledWith(
        { playlistsIds: ['PL2'] },
        { where: { id: 1 } },
      );
      expect(videoModel.destroy).toHaveBeenCalledWith({
        where: { ytChannelId: 1 },
      });
      expect(videoService.syncVideosFromYoutube).not.toHaveBeenCalled();
      expect(result.id).toBe(existing.id);
    });

    it('erases only non-validated videos when ignore patterns changed', async () => {
      commonMocks();
      youtubeService.getAllVideosFromPlaylists.mockResolvedValue([]);

      await service.update(1, {
        parsingOptions: { ignoreEpisodesContaining: ['(part 2)'] },
      });
      await flushMicrotasks();

      expect(videoModel.destroy).toHaveBeenCalledWith({
        where: { ytChannelId: 1, validated: { [Op.not]: true } },
      });
    });

    it('resets unsearched videos and regenerates games when the AI prompt changed', async () => {
      const existing = commonMocks();
      videoModel.findAll.mockResolvedValue([]);

      await service.update(1, {
        additionalGameCandidateAIPrompt: 'New prompt',
      });
      await flushMicrotasks();

      expect(videoModel.update).toHaveBeenCalledWith(
        { hasSearchedGames: false },
        { where: { ytChannelId: 1, validated: { [Op.not]: true } } },
      );
      expect(existing.get('name')).toBe('My Channel');
    });

    it('runs no side effect when nothing relevant changed', async () => {
      commonMocks();

      await service.update(1, { language: 'fr' });
      await flushMicrotasks();

      expect(channelModel.update).toHaveBeenCalledWith(
        { language: 'fr' },
        { where: { id: 1 } },
      );
      expect(videoModel.destroy).not.toHaveBeenCalled();
      expect(videoModel.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the channel is missing', async () => {
      channelModel.findByPk.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes the channel videos then the channel itself', async () => {
      const channel = channelInstance({
        ...baseChannelFields,
        videos: [videoInstance({ id: 1 }), videoInstance({ id: 2 })],
      });
      channelModel.findByPk.mockResolvedValue(channel);

      await service.remove(1);

      expect(videoModel.destroy).toHaveBeenCalledWith({
        where: { ytChannelId: 1 },
      });
      expect(channelModel.destroy).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('generateGamesForChannel', () => {
    it('throws NotFoundException when the channel is missing', async () => {
      channelModel.findByPk.mockResolvedValue(null);
      await expect(service.generateGamesForChannel(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('reports when there is nothing to generate', async () => {
      channelModel.findByPk.mockResolvedValue(
        channelInstance(baseChannelFields),
      );
      videoModel.count.mockResolvedValue(0);

      const result = await service.generateGamesForChannel(1);

      expect(result).toEqual({
        success: true,
        message: 'No unsearched videos found for this channel',
        updated: 0,
      });
      expect(videoModel.findAll).not.toHaveBeenCalled();
    });

    it('starts generation when unsearched videos exist', async () => {
      channelModel.findByPk.mockResolvedValue(
        channelInstance(baseChannelFields),
      );
      videoModel.count.mockResolvedValue(2);
      videoModel.findAll.mockResolvedValue([]);

      const result = await service.generateGamesForChannel(1);
      await flushMicrotasks();

      expect(result.message).toBe('Game generation started');
      expect(videoModel.findAll).toHaveBeenCalledWith({
        where: { ytChannelId: 1, hasSearchedGames: false },
      });
    });
  });

  describe('generateMissingVideosForAllChannels', () => {
    it('populates videos for every channel and continues after failures', async () => {
      const good = channelInstance({
        ...baseChannelFields,
        playlistsIds: ['PL1'],
        videos: [],
      });
      const bad = channelInstance({
        ...baseChannelFields,
        id: 4,
        playlistsIds: ['PL2'],
        videos: [],
      });
      channelModel.findAll.mockResolvedValue([good, bad]);
      youtubeService.getAllVideosFromPlaylists
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('boom'));
      youtubeService.isYoutubeShort.mockResolvedValue(false);

      await service.generateMissingVideosForAllChannels();

      expect(youtubeService.getAllVideosFromPlaylists).toHaveBeenCalledTimes(2);
      expect(appLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to populate videos'),
      );
    });

    it('filters out duplicate and ignored videos and marks Shorts as ignored', async () => {
      const channel = channelInstance({
        ...baseChannelFields,
        ignoreEpisodesContaining: ['/episode/i'],
        playlistsIds: ['PL1'],
        videos: [
          videoInstance({ id: 1, youtubeId: 'existing-video', title: 'Old' }),
        ],
      });
      channelModel.findAll.mockResolvedValue([channel]);
      youtubeService.getAllVideosFromPlaylists.mockResolvedValue([
        {
          videoId: 'existing-video',
          title: 'Old',
          description: '',
          thumbnailUrl: 'https://t',
          publishedAt: '2020-01-01',
        },
        {
          videoId: 'episode-5',
          title: 'Episode 5',
          description: '',
          thumbnailUrl: 'https://t',
          publishedAt: '2020-01-02',
        },
        {
          videoId: 'trailer',
          title: 'New trailer',
          description: 'desc',
          thumbnailUrl: 'https://t',
          publishedAt: '2020-01-03',
        },
      ]);
      youtubeService.isYoutubeShort.mockResolvedValue(true);
      let createArg: unknown;
      videoService.create.mockImplementation(async (videoDto: unknown) => {
        createArg = videoDto;
        return videoInstance({ id: 99 });
      });

      await service.generateMissingVideosForAllChannels();

      expect(videoService.create).toHaveBeenCalledTimes(1);
      expect(createArg).toEqual({
        title: 'New trailer',
        description: 'desc',
        youtubeId: 'trailer',
        releaseDate: '2020-01-03',
        validated: false,
        ignored: true,
        thumbnailUrl: 'https://t',
        gamesFoundCount: 0,
        gamesCount: 0,
        ytChannelId: 3,
      });
      expect(appLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Ignored 1 videos based on ignore patterns'),
      );
      expect(appLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Detected 1 Shorts videos'),
      );
    });
  });

  describe('syncAllYoutubeChannels', () => {
    it('syncs infos, videos, shorts and games for every channel', async () => {
      const setMock = jest.fn();
      const changedMock = jest.fn().mockReturnValue(['name']);
      const previousMock = jest.fn().mockReturnValue('old name');
      const saveMock = jest.fn().mockResolvedValue(undefined);
      const channel = channelInstance({
        ...baseChannelFields,
        set: setMock,
        changed: changedMock,
        previous: previousMock,
        save: saveMock,
        videos: [videoInstance({ id: 1 })],
      });

      channelModel.findAll.mockResolvedValue([channel]);
      youtubeService.getYtChannelInfosById.mockResolvedValue(
        cast<never>({
          id: 'UC',
          snippet: {
            title: 'New Name',
            description: 'new desc',
            thumbnails: { default: { url: 'new-thumb.png' } },
          },
        }),
      );
      videoModel.count.mockResolvedValue(0);

      await service.syncAllYoutubeChannels();

      expect(youtubeService.getYtChannelInfosById).toHaveBeenCalledWith('UC');
      expect(setMock).toHaveBeenCalledWith({
        name: 'New Name',
        description: 'new desc',
        thumbnailUrl: 'new-thumb.png',
      });
      expect(saveMock).toHaveBeenCalled();
      expect(videoService.syncVideosFromYoutube).toHaveBeenCalledWith(channel);
      expect(videoService.purgeShortsFromChannel).toHaveBeenCalledWith(channel);
      expect(videoService.regenerateGamesForVideo).not.toHaveBeenCalled();
    });
  });
});
