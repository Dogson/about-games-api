import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VideoService } from './video.service';
import { createModelMock } from 'src/testing/model-mock';
import { createAppLoggerMock } from 'src/testing/logger-stub';
import { cast } from 'src/testing/cast';
import { Video } from './entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';
import { Game } from '../game/entities/game.entity';
import { IgdbService } from '../igdb/igdb.service';
import { GameService } from '../game/game.service';
import { YoutubeService } from '../youtube/youtube.service';
import { ChannelService } from '../channel/channel.service';
import { DeepseekService } from '../ai/deepseek.service';
import { AppLogger } from '../logging/app-logger.service';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import type { CreateVideoDto } from './dto/create-video.dto';
import type { UpdateVideoDto } from './dto/update-video.dto';
import type { CreateGameDto } from '../game/dto/create-game.dto';
import { DEFAULT_GAME_CANDIDATE_AI_PROMPT } from '../ai/game-candidate.prompt';
import type { IGDBGame } from '../igdb/dto/igdb-get-game.dto';

const VideosHasGamesStub = VideosHasGames as unknown as {
  destroy: jest.Mock;
  bulkCreate: jest.Mock;
};

function modelInstance<T>(fields: Record<string, unknown>): T {
  const instance: Record<string, unknown> = {
    id: fields.id,
    ...fields,
    get: (keyOrOptions: unknown): unknown => {
      if (typeof keyOrOptions === 'string') {
        return fields[keyOrOptions];
      }
      return fields;
    },
  };
  if (typeof fields['update'] !== 'function') {
    instance.update = jest.fn().mockResolvedValue(undefined);
  }
  if (typeof fields['destroy'] !== 'function') {
    instance.destroy = jest.fn().mockResolvedValue(undefined);
  }
  return cast<T>(instance);
}

describe('VideoService', () => {
  let videoModel: ReturnType<typeof createModelMock>;
  let igdbService: jest.Mocked<Pick<IgdbService, 'findGamesByNames'>>;
  let gameService: jest.Mocked<
    Pick<GameService, 'mapIgdbGamesToCreateGamesDTO' | 'findOrCreateGames'>
  >;
  let youtubeService: jest.Mocked<
    Pick<YoutubeService, 'getAllVideosFromPlaylists' | 'isYoutubeShort'>
  >;
  let channelService: jest.Mocked<Pick<ChannelService, 'findOne'>>;
  let deepseekService: jest.Mocked<
    Pick<DeepseekService, 'extractMainGameNames'>
  >;
  let appLogger: ReturnType<typeof createAppLoggerMock>;
  let service: VideoService;

  const dto: CreateVideoDto = {
    ytChannelId: 3,
    title: 'Best of Zelda',
    youtubeId: 'yt-1',
    description: 'desc',
    thumbnailUrl: 'https://thumb',
  };

  const igdbGame: IGDBGame = {
    id: 1025,
    name: 'Zelda',
    release_dates: [],
    involved_companies: [],
  };

  const createGameDto: CreateGameDto = {
    title: 'Zelda',
    igdbId: 1025,
    releaseDate: new Date('2017-03-03'),
    companies: ['Nintendo'],
    coverImg: null,
    boxartImg: null,
  };

  const defaultChannel = modelInstance<Channel>({
    id: 3,
    additionalGameCandidateAIPrompt: undefined,
    playlistsIds: null,
    youtubeUploadsId: 'UU',
    name: 'channel',
  });

  beforeEach(() => {
    videoModel = createModelMock();
    igdbService = {
      findGamesByNames: jest.fn(),
    } as unknown as jest.Mocked<Pick<IgdbService, 'findGamesByNames'>>;
    gameService = {
      mapIgdbGamesToCreateGamesDTO: jest.fn(),
      findOrCreateGames: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<GameService, 'mapIgdbGamesToCreateGamesDTO' | 'findOrCreateGames'>
    >;
    youtubeService = {
      getAllVideosFromPlaylists: jest.fn(),
      isYoutubeShort: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<YoutubeService, 'getAllVideosFromPlaylists' | 'isYoutubeShort'>
    >;
    channelService = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Pick<ChannelService, 'findOne'>>;
    deepseekService = {
      extractMainGameNames: jest.fn(),
    } as unknown as jest.Mocked<Pick<DeepseekService, 'extractMainGameNames'>>;
    appLogger = createAppLoggerMock();

    VideosHasGamesStub.destroy = jest.fn().mockResolvedValue(undefined);
    VideosHasGamesStub.bulkCreate = jest.fn().mockResolvedValue(undefined);

    service = new VideoService(
      cast<typeof Video>(videoModel),
      cast<IgdbService>(igdbService),
      cast<GameService>(gameService),
      cast<YoutubeService>(youtubeService),
      cast<ChannelService>(channelService),
      cast<DeepseekService>(deepseekService),
      cast<AppLogger>(appLogger),
    );
  });

  describe('create', () => {
    it('propagates the NotFoundException when the channel is missing', async () => {
      channelService.findOne.mockRejectedValue(
        new NotFoundException('Channel with id 3 not found'),
      );

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(videoModel.findOne).not.toHaveBeenCalled();
    });

    it('rejects duplicates by youtubeId', async () => {
      channelService.findOne.mockResolvedValue(defaultChannel);
      videoModel.findOne.mockResolvedValue(modelInstance<Video>({ id: 1 }));

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(videoModel.create).not.toHaveBeenCalled();
    });

    it('creates the video with hasSearchedGames=false and links games', async () => {
      channelService.findOne.mockResolvedValue(defaultChannel);
      videoModel.findOne.mockResolvedValue(null);
      const created = modelInstance<Video>({ id: 1, ...dto });
      videoModel.create.mockResolvedValue(created);

      deepseekService.extractMainGameNames.mockResolvedValue(['zelda']);
      igdbService.findGamesByNames.mockResolvedValue([igdbGame]);
      gameService.mapIgdbGamesToCreateGamesDTO.mockReturnValue(createGameDto);
      gameService.findOrCreateGames.mockResolvedValue([cast<Game>({ id: 9 })]);

      await expect(service.create(dto)).resolves.toBe(created);

      expect(videoModel.create).toHaveBeenCalledWith({
        ...dto,
        hasSearchedGames: false,
      });
      expect(deepseekService.extractMainGameNames).toHaveBeenCalledWith(
        DEFAULT_GAME_CANDIDATE_AI_PROMPT,
        dto.title,
        dto.description,
      );
      expect(igdbService.findGamesByNames).toHaveBeenCalledWith(['zelda']);
      expect(gameService.findOrCreateGames).toHaveBeenCalledWith([
        createGameDto,
      ]);
      expect(VideosHasGamesStub.destroy).toHaveBeenCalledWith({
        where: { videoId: 1 },
      });
      expect(VideosHasGamesStub.bulkCreate).toHaveBeenCalledWith([
        { videoId: 1, gameId: 9, rank: 0 },
      ]);
      expect(created.update).toHaveBeenCalledWith({
        hasSearchedGames: true,
        gamesCount: 1,
        gamesFoundCount: 1,
      });
    });

    it('appends the channel AI prompt when configured', async () => {
      const channelWithPrompt = modelInstance<Channel>({
        id: 3,
        additionalGameCandidateAIPrompt: '  Focus on remakes  ',
        playlistsIds: null,
        youtubeUploadsId: 'UU',
        name: 'channel',
      });
      channelService.findOne.mockResolvedValue(channelWithPrompt);
      videoModel.findOne.mockResolvedValue(null);
      const created = modelInstance<Video>({ id: 1, ...dto });
      videoModel.create.mockResolvedValue(created);
      deepseekService.extractMainGameNames.mockResolvedValue([]);
      igdbService.findGamesByNames.mockResolvedValue([]);
      gameService.findOrCreateGames.mockResolvedValue([]);

      let promptArg: unknown;
      deepseekService.extractMainGameNames.mockImplementation(
        async (prompt: unknown) => {
          promptArg = prompt;
          return [];
        },
      );

      await service.create(dto);

      expect(promptArg).toBe(
        `${DEFAULT_GAME_CANDIDATE_AI_PROMPT}\n\nAdditional instructions:\nFocus on remakes`,
      );
    });

    it('swallows game-linking failures but still returns the video', async () => {
      channelService.findOne.mockResolvedValue(defaultChannel);
      videoModel.findOne.mockResolvedValue(null);
      const created = modelInstance<Video>({ id: 1, ...dto });
      videoModel.create.mockResolvedValue(created);
      deepseekService.extractMainGameNames.mockRejectedValue(
        new Error('API down'),
      );

      await expect(service.create(dto)).resolves.toBe(created);
      expect(appLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract games'),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the video does not exist', async () => {
      videoModel.findByPk.mockResolvedValue(null);
      await expect(service.update(1, { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('recomputes gamesFoundCount for non-validated videos and rewrites joins', async () => {
      const existing = modelInstance<Video>({
        id: 1,
        validated: false,
        gamesFoundCount: 3,
        games: [
          modelInstance<Game>({ id: 1, igdbId: 10 }),
          modelInstance<Game>({ id: 2, igdbId: 20 }),
        ],
      });
      const finalVideo = modelInstance<Video>({ id: 1 });
      videoModel.findByPk
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(finalVideo);

      const games: CreateGameDto[] = [
        {
          igdbId: 20,
          title: 'Game B',
          releaseDate: new Date('2020-01-01'),
          companies: [],
          coverImg: null,
          boxartImg: null,
        },
        {
          igdbId: 30,
          title: 'Game C',
          releaseDate: new Date('2021-01-01'),
          companies: [],
          coverImg: null,
          boxartImg: null,
        },
      ];
      const updateDto: UpdateVideoDto = { title: 'new', games };
      gameService.findOrCreateGames.mockResolvedValue([cast<Game>({ id: 2 })]);

      await expect(service.update(1, updateDto)).resolves.toBe(finalVideo);

      expect(existing.update).toHaveBeenCalledWith({
        title: 'new',
        gamesFoundCount: 1,
        gamesCount: 2,
      });
      expect(gameService.findOrCreateGames).toHaveBeenCalledWith(games);
      expect(VideosHasGamesStub.destroy).toHaveBeenCalledWith({
        where: { videoId: 1 },
      });
      expect(VideosHasGamesStub.bulkCreate).toHaveBeenCalledWith([
        { videoId: 1, gameId: 2, rank: 0 },
      ]);
    });

    it('keeps gamesFoundCount for validated videos and skips the join rewrite without games', async () => {
      const existing = modelInstance<Video>({
        id: 1,
        validated: true,
        gamesFoundCount: 5,
        games: [],
      });
      const finalVideo = modelInstance<Video>({ id: 1 });
      videoModel.findByPk
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(finalVideo);

      await expect(service.update(1, { title: 'only title' })).resolves.toBe(
        finalVideo,
      );

      expect(existing.update).toHaveBeenCalledWith({
        title: 'only title',
        gamesFoundCount: 5,
        gamesCount: 0,
      });
      expect(VideosHasGamesStub.bulkCreate).not.toHaveBeenCalled();
    });

    it('resets gamesFoundCount to 0 for non-validated videos without games', async () => {
      const existing = modelInstance<Video>({
        id: 1,
        validated: false,
        gamesFoundCount: 5,
        games: [],
      });
      const finalVideo = modelInstance<Video>({ id: 1 });
      videoModel.findByPk
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(finalVideo);

      await service.update(1, { title: 'x' });

      expect(existing.update).toHaveBeenCalledWith({
        title: 'x',
        gamesFoundCount: 0,
        gamesCount: 0,
      });
    });
  });

  describe('syncVideosFromYoutube', () => {
    it('destroys videos absent from YouTube and updates changed ones', async () => {
      const removed = modelInstance<Video>({
        id: 1,
        youtubeId: 'gone',
        title: 'Removed',
        thumbnailUrl: 'a',
        description: 'a',
        destroy: jest.fn().mockResolvedValue(undefined),
      });
      const changed = modelInstance<Video>({
        id: 2,
        youtubeId: 'yt-1',
        title: 'Old title',
        thumbnailUrl: 'https://old',
        description: 'old desc',
        update: jest.fn().mockResolvedValue(undefined),
      });
      const channel = modelInstance<Channel>({
        id: 3,
        name: 'My Channel',
        playlistsIds: ['PL1'],
        youtubeUploadsId: 'UU',
        videos: [removed, changed],
      });
      youtubeService.getAllVideosFromPlaylists.mockResolvedValue([
        {
          videoId: 'yt-1',
          title: 'New title',
          description: 'new desc',
          thumbnailUrl: 'https://new',
          publishedAt: '2020',
        },
      ]);

      await service.syncVideosFromYoutube(channel);

      expect(youtubeService.getAllVideosFromPlaylists).toHaveBeenCalledWith([
        'PL1',
      ]);
      expect(removed.destroy).toHaveBeenCalled();
      expect(changed.update).toHaveBeenCalledWith({
        thumbnailUrl: 'https://new',
        title: 'New title',
        description: 'new desc',
      });
      expect(appLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Removed 1 deleted videos'),
      );
      expect(appLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Updated 1 videos'),
      );
    });

    it('falls back to the uploads playlist when no playlists are configured', async () => {
      const channel = modelInstance<Channel>({
        id: 3,
        name: 'My Channel',
        playlistsIds: null,
        youtubeUploadsId: 'UU',
        videos: [],
      });
      youtubeService.getAllVideosFromPlaylists.mockResolvedValue([]);

      await service.syncVideosFromYoutube(channel);

      expect(youtubeService.getAllVideosFromPlaylists).toHaveBeenCalledWith([
        'UU',
      ]);
    });

    it('logs and swallows unexpected errors', async () => {
      const channel = modelInstance<Channel>({
        id: 3,
        name: 'My Channel',
        playlistsIds: null,
        youtubeUploadsId: 'UU',
        videos: [],
      });
      youtubeService.getAllVideosFromPlaylists.mockRejectedValue(
        new Error('network'),
      );

      await expect(
        service.syncVideosFromYoutube(channel),
      ).resolves.toBeUndefined();
      expect(appLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove deleted videos'),
      );
    });
  });

  describe('purgeShortsFromChannel', () => {
    it('destroys videos detected as Shorts', async () => {
      const short = modelInstance<Video>({
        id: 1,
        youtubeId: 'short-1',
        title: 'Clip',
        destroy: jest.fn().mockResolvedValue(undefined),
      });
      const regular = modelInstance<Video>({
        id: 2,
        youtubeId: 'video-1',
        title: 'Long video',
        destroy: jest.fn().mockResolvedValue(undefined),
      });
      const channel = modelInstance<Channel>({
        id: 3,
        name: 'My Channel',
        videos: [short, regular],
      });
      youtubeService.isYoutubeShort
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.purgeShortsFromChannel(channel);

      expect(short.destroy).toHaveBeenCalled();
      expect(regular.destroy).not.toHaveBeenCalled();
      expect(appLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Removed 1 Shorts videos'),
      );
    });

    it('does nothing when no video is a Short', async () => {
      const video = modelInstance<Video>({
        id: 1,
        youtubeId: 'video-1',
        title: 'Long video',
        destroy: jest.fn().mockResolvedValue(undefined),
      });
      const channel = modelInstance<Channel>({
        id: 3,
        name: 'My Channel',
        videos: [video],
      });
      youtubeService.isYoutubeShort.mockResolvedValue(false);

      await service.purgeShortsFromChannel(channel);

      expect(video.destroy).not.toHaveBeenCalled();
      expect(appLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Removed 1 Shorts videos'),
      );
    });
  });

  describe('findAll', () => {
    it('filters by validated and hasSearchedGames and orders by join rank', async () => {
      let captured: unknown;
      videoModel.findAll.mockImplementation(async (options: unknown) => {
        captured = options;
        return [];
      });

      await service.findAll({ validated: true, hasSearchedGames: false });

      const opts = captured as {
        where: unknown;
        include: unknown[];
        order: unknown;
      };
      expect(opts.where).toEqual({ validated: true, hasSearchedGames: false });
      expect(opts.order).toBeDefined();
    });

    it('returns all videos when no filter is passed', async () => {
      let captured: unknown;
      videoModel.findAll.mockImplementation(async (options: unknown) => {
        captured = options;
        return [];
      });

      await service.findAll();

      const opts = captured as { where: unknown };
      expect(opts.where).toEqual({});
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the video does not exist', async () => {
      videoModel.findByPk.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the found video', async () => {
      const found = modelInstance<Video>({ id: 1 });
      videoModel.findByPk.mockResolvedValue(found);
      await expect(service.findOne(1)).resolves.toBe(found);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when nothing was deleted', async () => {
      videoModel.destroy.mockResolvedValue(0);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('destroys the video when rows were deleted', async () => {
      videoModel.destroy.mockResolvedValue(1);
      await service.remove(1);
      expect(videoModel.destroy).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('regenerateGamesForVideo', () => {
    it('refetches the channel and reruns the game search for the video', async () => {
      const video = modelInstance<Video>({
        id: 1,
        ytChannelId: 3,
        title: 'Title',
        description: 'Desc',
      });
      channelService.findOne.mockResolvedValue(defaultChannel);
      deepseekService.extractMainGameNames.mockResolvedValue([]);
      igdbService.findGamesByNames.mockResolvedValue([]);
      gameService.findOrCreateGames.mockResolvedValue([]);

      await service.regenerateGamesForVideo(video);

      expect(channelService.findOne).toHaveBeenCalledWith(3);
      expect(deepseekService.extractMainGameNames).toHaveBeenCalledWith(
        DEFAULT_GAME_CANDIDATE_AI_PROMPT,
        'Title',
        'Desc',
      );
      expect(video.update).toHaveBeenCalledWith({
        hasSearchedGames: true,
        gamesCount: 0,
        gamesFoundCount: 0,
      });
    });
  });
});
