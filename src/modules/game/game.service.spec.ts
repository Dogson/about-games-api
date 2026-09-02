import { NotFoundException } from '@nestjs/common';
import { createModelMock } from 'src/testing/model-mock';
import { createAppLoggerMock } from 'src/testing/logger-stub';
import { cast } from 'src/testing/cast';
import { GameService } from './game.service';
import { IgdbService } from '../igdb/igdb.service';
import { DeepseekService } from '../ai/deepseek.service';
import { AppLogger } from '../logging/app-logger.service';
import { Game } from './entities/game.entity';
import { Channel } from '../channel/entities/channel.entity';
import { Video } from '../video/entities/video.entity';
import { DEFAULT_GAME_CANDIDATE_AI_PROMPT } from '../ai/game-candidate.prompt';
import type { IGDBGame } from '../igdb/dto/igdb-get-game.dto';
import type { CreateGameDto } from './dto/create-game.dto';
import type { FindAllGamesDto } from './dto/find-all-games.dto';

/**
 * Builds a plain, comparable tree from query options: symbol keys become
 * `$name`, Sequelize literal/col nodes keep their raw string payload.
 */
function inspect(node: unknown): unknown {
  if (node === null || typeof node !== 'object') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(inspect);
  }
  const obj = node as Record<PropertyKey, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(obj)) {
    if (key === 'constructor') continue;
    const label = typeof key === 'symbol' ? `$${key.description}` : String(key);
    result[label] = inspect(obj[key]);
  }
  return result;
}

function collectSqlStrings(node: unknown, acc: string[] = []): string[] {
  if (node === null || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectSqlStrings(item, acc);
    return acc;
  }
  const obj = node as Record<PropertyKey, unknown>;
  const val = obj['val'];
  if (typeof val === 'string') acc.push(val);
  for (const key of Reflect.ownKeys(obj)) {
    const child = obj[key];
    if (child !== node) collectSqlStrings(child, acc);
  }
  return acc;
}

function collectStringValues(node: unknown, acc: string[] = []): string[] {
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStringValues(item, acc);
    return acc;
  }
  if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectStringValues(value, acc);
    }
  }
  return acc;
}

function collectAttributeAliases(options: unknown): string[] {
  const attributes = (
    inspect(options) as {
      attributes?: { include?: unknown[] };
    }
  ).attributes;
  const include = attributes?.include ?? [];
  const aliases: string[] = [];
  for (const row of include) {
    const tuple = row as unknown[];
    if (typeof tuple[1] === 'string') aliases.push(tuple[1]);
  }
  return aliases;
}

describe('GameService', () => {
  let gameModel: ReturnType<typeof createModelMock>;
  let igdbService: jest.Mocked<
    Pick<
      IgdbService,
      | 'getIGDBGameById'
      | 'queryIGDBById'
      | 'queryIGDBByName'
      | 'findGamesByNames'
    >
  >;
  let deepseekService: jest.Mocked<
    Pick<DeepseekService, 'extractMainGameNames'>
  >;
  let appLogger: ReturnType<typeof createAppLoggerMock>;
  let service: GameService;

  const gameRow = (plain: Record<string, unknown>) =>
    cast<Game>({
      id: plain['id'],
      get: (keyOrOptions: unknown): unknown => {
        if (typeof keyOrOptions === 'string') {
          return plain[keyOrOptions];
        }
        return plain;
      },
    });

  beforeEach(() => {
    gameModel = createModelMock();
    igdbService = {
      getIGDBGameById: jest.fn(),
      queryIGDBById: jest.fn(),
      queryIGDBByName: jest.fn(),
      findGamesByNames: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<
        IgdbService,
        | 'getIGDBGameById'
        | 'queryIGDBById'
        | 'queryIGDBByName'
        | 'findGamesByNames'
      >
    >;
    deepseekService = {
      extractMainGameNames: jest.fn(),
    } as unknown as jest.Mocked<Pick<DeepseekService, 'extractMainGameNames'>>;
    appLogger = createAppLoggerMock();

    service = new GameService(
      cast<typeof Game>(gameModel),
      cast<IgdbService>(igdbService),
      cast<DeepseekService>(deepseekService),
      cast<AppLogger>(appLogger),
    );
  });

  describe('create', () => {
    it('creates a game from the dto', async () => {
      const dto: CreateGameDto = {
        igdbId: 12,
        title: 'Hollow Knight',
        releaseDate: new Date('2017-02-24'),
        companies: ['Team Cherry'],
        coverImg: 'cover.png',
        boxartImg: null,
      };
      const created = cast<Game>({ id: 1 });
      gameModel.create.mockResolvedValue(created);

      await expect(service.create(dto)).resolves.toBe(created);
      expect(gameModel.create).toHaveBeenCalledWith({ ...dto });
    });
  });

  describe('findAll', () => {
    it('uses defaults (limit 30, page 1) and no filters when nothing is given', async () => {
      let captured: unknown;
      gameModel.findAndCountAll.mockImplementation(async (options: unknown) => {
        captured = options;
        return { rows: [], count: 0 };
      });

      await service.findAll({});

      const opts = inspect(captured) as Record<string, unknown>;
      expect(opts['limit']).toBe(30);
      expect(opts['offset']).toBe(0);
      expect(opts['distinct']).toBe(true);
      expect(opts['where']).toEqual({ $and: [] });
      expect(collectAttributeAliases(captured)).toEqual(['videosCount']);

      const sql = collectSqlStrings(captured);
      expect(sql.join('\n')).toContain('COUNT(*)');
      expect(sql.join('\n')).not.toContain('validated');

      expect(opts['order']).toEqual([
        ['updated_at', 'DESC'],
        ['id', 'ASC'],
      ]);
    });

    it('builds the relevance MATCH condition and paginates', async () => {
      let captured: unknown;
      gameModel.findAndCountAll.mockImplementation(async (options: unknown) => {
        captured = options;
        return { rows: [], count: 25 };
      });

      const dto: FindAllGamesDto = {
        search: "it's uncharted",
        page: 3,
        limit: 10,
      };
      const result = await service.findAll(dto);

      const sql = collectSqlStrings(captured);
      const joined = sql.join('\n');
      expect(joined).toContain(
        "MATCH(Game.title) AGAINST('it\\'s uncharted' IN NATURAL LANGUAGE MODE)",
      );
      expect(collectStringValues(inspect(captured))).toEqual(
        expect.arrayContaining(["(?i)\\bit's uncharted"]),
      );

      expect(result).toEqual({
        data: [],
        total: 25,
        page: 3,
        limit: 10,
        totalPages: 3,
      });

      const opts = inspect(captured) as Record<string, unknown>;
      expect(opts['offset']).toBe(20);
      expect(opts['order']).toEqual([
        [{ col: 'relevance' }, 'DESC'],
        ['updated_at', 'DESC'],
        ['id', 'ASC'],
      ]);
    });

    it('adds a language EXISTS subquery and filters onlyValidated and igdbId', async () => {
      let captured: unknown;
      gameModel.findAndCountAll.mockImplementation(async (options: unknown) => {
        captured = options;
        return { rows: [], count: 0 };
      });

      const dto: FindAllGamesDto = {
        search: 'uncharted',
        igdbId: 7,
        languages: ['ENGLISH', ' fr '],
        onlyValidated: true,
      };
      await service.findAll(dto);

      const sql = collectSqlStrings(captured);
      const joined = sql.join('\n');
      expect(joined).toContain("LOWER(c.language) IN ('english', 'fr')");
      expect(joined).toContain('AND v.validated = 1');
      expect(joined).toContain(
        "MATCH(Game.title) AGAINST('uncharted' IN NATURAL LANGUAGE MODE)",
      );
    });

    it('does not include validated or language filters when not requested', async () => {
      let captured: unknown;
      gameModel.findAndCountAll.mockImplementation(async (options: unknown) => {
        captured = options;
        return { rows: [], count: 0 };
      });

      await service.findAll({ search: 'uncharted' });

      const sql = collectSqlStrings(captured);
      const joined = sql.join('\n');
      expect(joined).not.toContain('validated');
      expect(joined).not.toContain('language');
    });

    it('includes videos and channel when withVideos is set', async () => {
      let captured: unknown;
      gameModel.findAndCountAll.mockImplementation(async (options: unknown) => {
        captured = options;
        return { rows: [], count: 0 };
      });

      await service.findAll({ withVideos: true });

      const opts = inspect(captured) as { include?: unknown };
      expect(opts['include']).toEqual([
        {
          model: Video,
          through: { attributes: [] },
          required: false,
          include: [{ model: Channel }],
        },
      ]);
    });

    it('does not include relations when withVideos is absent', async () => {
      let captured: unknown;
      gameModel.findAndCountAll.mockImplementation(async (options: unknown) => {
        captured = options;
        return { rows: [], count: 0 };
      });

      await service.findAll({});

      const opts = inspect(captured) as Record<string, unknown>;
      expect(opts['include']).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('throws a NotFoundException when the game is missing', async () => {
      gameModel.findByPk.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the game and builds default includes (validated videos only)', async () => {
      let captured: unknown;
      const found = cast<Game>({ id: 1 });
      gameModel.findByPk.mockImplementation(
        async (_id: unknown, options: unknown) => {
          captured = options;
          return found;
        },
      );

      await expect(service.findOne(1)).resolves.toBe(found);

      const videoInclude = (inspect(captured) as { include: unknown[] })
        .include[0] as Record<string, unknown>;
      expect(videoInclude['where']).toEqual({ validated: true });
      const channelInclude = (
        videoInclude['include'] as Record<string, unknown>[]
      )[0];
      expect(channelInclude['required']).toBeUndefined();
      expect(channelInclude['where']).toBeUndefined();
    });

    it('skips the validated filter and narrows channels by language when requested', async () => {
      let captured: unknown;
      gameModel.findByPk.mockImplementation(
        async (_id: unknown, options: unknown) => {
          captured = options;
          return cast<Game>({ id: 1 });
        },
      );

      await service.findOne(1, false, [' FR ', 'ENGLISH']);

      const videoInclude = (inspect(captured) as { include: unknown[] })
        .include[0] as Record<string, unknown>;
      expect(videoInclude['where']).toBeUndefined();
      const channelInclude = (
        videoInclude['include'] as Record<string, unknown>[]
      )[0];
      expect(channelInclude['required']).toBe(true);
      expect(channelInclude['where']).toEqual({
        language: { $in: ['fr', 'english'] },
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the game does not exist', async () => {
      gameModel.findByPk.mockResolvedValue(null);
      await expect(service.update(1, { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('updates and returns the refreshed game', async () => {
      const existing = cast<Game>({ id: 1 });
      const updated = cast<Game>({ id: 1, title: 'Renamed' });
      gameModel.findByPk
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      await expect(service.update(1, { title: 'Renamed' })).resolves.toBe(
        updated,
      );
      expect(gameModel.update).toHaveBeenCalledWith(
        { title: 'Renamed' },
        { where: { id: 1 } },
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when nothing was deleted', async () => {
      gameModel.destroy.mockResolvedValue(0);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('destroys the game when rows were deleted', async () => {
      gameModel.destroy.mockResolvedValue(1);
      await service.remove(1);
      expect(gameModel.destroy).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('findOrCreateGames', () => {
    it('finds or creates every game in parallel', async () => {
      const dtoA: CreateGameDto = {
        igdbId: 1,
        title: 'Game A',
        releaseDate: new Date('2020-01-01'),
        companies: ['Studio A'],
        coverImg: null,
        boxartImg: null,
      };
      const dtoB: CreateGameDto = {
        igdbId: 2,
        title: 'Game B',
        releaseDate: new Date('2021-01-01'),
        companies: [],
        coverImg: null,
        boxartImg: null,
      };
      const gameA = cast<Game>({ id: 1 });
      const gameB = cast<Game>({ id: 2 });

      gameModel.findOrCreate
        .mockResolvedValueOnce([gameA, false])
        .mockResolvedValueOnce([gameB, true]);

      await expect(service.findOrCreateGames([dtoA, dtoB])).resolves.toEqual([
        gameA,
        gameB,
      ]);

      expect(gameModel.findOrCreate).toHaveBeenNthCalledWith(1, {
        where: { igdbId: 1 },
        defaults: { ...dtoA },
      });
      expect(gameModel.findOrCreate).toHaveBeenNthCalledWith(2, {
        where: { igdbId: 2 },
        defaults: { ...dtoB },
      });
    });
  });

  describe('mapIgdbGamesToCreateGamesDTO', () => {
    it('maps an IGDB game to a create dto using the earliest release date', () => {
      const igdbGame: IGDBGame = {
        id: 1942,
        name: 'The Witcher 3: Wild Hunt',
        release_dates: [{ date: 1420070400 }, { date: 100 }],
        cover: {
          url: '//images.igdb.com/igdb/image/upload/t_thumb/co1.jpg',
        },
        screenshots: [
          { url: '//images.igdb.com/igdb/image/upload/t_thumb/sc1.jpg' },
        ],
        involved_companies: [
          { company: { id: 9, name: 'CD PROJEKT RED' } },
          { company: { id: 423, name: 'CD PROJEKT RED' } },
        ],
      };

      expect(service.mapIgdbGamesToCreateGamesDTO(igdbGame)).toEqual({
        title: 'The Witcher 3: Wild Hunt',
        igdbId: 1942,
        boxartImg:
          'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
        coverImg: 'https://images.igdb.com/igdb/image/upload/t_1080p/sc1.jpg',
        releaseDate: new Date(100000),
        companies: ['CD PROJEKT RED', 'CD PROJEKT RED'],
      });
    });

    it('returns nullish optional fields when the data is missing', () => {
      const igdbGame: IGDBGame = { id: 1, name: 'Naked Game' };
      expect(service.mapIgdbGamesToCreateGamesDTO(igdbGame)).toEqual({
        title: 'Naked Game',
        igdbId: 1,
        boxartImg: null,
        coverImg: null,
        releaseDate: null,
        companies: [],
      });
    });
  });

  describe('syncAllGamesWithIgdb', () => {
    beforeEach(() => {
      jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('does nothing when every game is up to date', async () => {
      const plain = {
        id: 1,
        title: 'The Witcher 3: Wild Hunt',
        igdbId: 1942,
        releaseDate: new Date(1420070400000),
        companies: ['CD PROJEKT RED'],
        coverImg: null,
        boxartImg: null,
      };
      gameModel.findAll.mockResolvedValue([gameRow(plain)]);
      const igdbGame: IGDBGame = {
        id: 1942,
        name: 'The Witcher 3: Wild Hunt',
        release_dates: [{ date: 1420070400 }],
        involved_companies: [{ company: { id: 9, name: 'CD PROJEKT RED' } }],
      };
      igdbService.getIGDBGameById.mockResolvedValue(igdbGame);

      await service.syncAllGamesWithIgdb();

      expect(gameModel.update).not.toHaveBeenCalled();
      expect(appLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('already up-to-date'),
      );
    });

    it('updates the game when IGDB data changed', async () => {
      const plain = {
        id: 1,
        title: 'The Witcher 3: Wild Hunt',
        igdbId: 1942,
        releaseDate: new Date(1420070400000),
        companies: ['OLD STUDIO'],
        coverImg: null,
        boxartImg: 'cover.png',
      };
      gameModel.findAll.mockResolvedValue([gameRow(plain)]);
      const igdbGame: IGDBGame = {
        id: 1942,
        name: 'The Witcher 3: Wild Hunt',
        release_dates: [{ date: 1420070400 }],
        involved_companies: [{ company: { id: 9, name: 'CD PROJEKT RED' } }],
      };
      igdbService.getIGDBGameById.mockResolvedValue(igdbGame);
      const updateSpy = jest
        .spyOn(service, 'update')
        .mockResolvedValue(cast<Game>({ id: 1 }));

      await service.syncAllGamesWithIgdb();

      expect(updateSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ companies: ['CD PROJEKT RED'] }),
      );
      expect(appLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Updated game The Witcher 3: Wild Hunt'),
      );
    });

    it('retries up to three times when IGDB answers 429', async () => {
      jest.useFakeTimers();
      try {
        const plain = {
          id: 1,
          title: 'Game',
          igdbId: 42,
          releaseDate: null,
          companies: [],
          coverImg: null,
          boxartImg: null,
        };
        gameModel.findAll.mockResolvedValue([gameRow(plain)]);
        const rateLimited = cast<
          Error & { isAxiosError: boolean; response: { status: number } }
        >({
          isAxiosError: true,
          response: { status: 429 },
          name: 'Error',
          message: 'rate limited',
        });
        igdbService.getIGDBGameById.mockRejectedValue(rateLimited);

        const syncPromise = service.syncAllGamesWithIgdb();
        await jest.runAllTimersAsync();
        await syncPromise;

        expect(igdbService.getIGDBGameById).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
    });

    it('rethrows non-rate-limit errors from IGDB', async () => {
      const plain = {
        id: 1,
        title: 'Game',
        igdbId: 42,
        releaseDate: null,
        companies: [],
        coverImg: null,
        boxartImg: null,
      };
      gameModel.findAll.mockResolvedValue([gameRow(plain)]);
      igdbService.getIGDBGameById.mockRejectedValue(new Error('boom'));

      await expect(service.syncAllGamesWithIgdb()).rejects.toThrow('boom');
    });
  });

  describe('igdbSearch', () => {
    it('queries by id when the query starts with id', async () => {
      igdbService.queryIGDBById.mockResolvedValue([]);
      await service.igdbSearch('id:123');
      expect(igdbService.queryIGDBById).toHaveBeenCalledWith(123);
      expect(igdbService.queryIGDBByName).not.toHaveBeenCalled();
    });

    it('queries by name with a 500 limit', async () => {
      igdbService.queryIGDBByName.mockResolvedValue([]);
      await service.igdbSearch('uncharted');
      expect(igdbService.queryIGDBByName).toHaveBeenCalledWith('uncharted', {
        limit: 500,
      });
    });

    it('passes the year option when the query contains one', async () => {
      igdbService.queryIGDBByName.mockResolvedValue([]);
      await service.igdbSearch('uncharted (2015)');
      expect(igdbService.queryIGDBByName).toHaveBeenCalledWith('uncharted', {
        limit: 500,
        year: 2015,
      });
    });
  });

  describe('igdbSearchWithinText', () => {
    it('delegates to deepseek then resolves candidate names on IGDB', async () => {
      deepseekService.extractMainGameNames.mockResolvedValue(['Uncharted 4']);
      igdbService.findGamesByNames.mockResolvedValue([]);

      await service.igdbSearchWithinText('Video about uncharted');

      expect(deepseekService.extractMainGameNames).toHaveBeenCalledWith(
        DEFAULT_GAME_CANDIDATE_AI_PROMPT,
        'Video about uncharted',
        '',
      );
      expect(igdbService.findGamesByNames).toHaveBeenCalledWith([
        'Uncharted 4',
      ]);
    });
  });
});
