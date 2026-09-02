import axios, { AxiosResponse } from 'axios';
import { IgdbService } from './igdb.service';
import { GameService } from '../game/game.service';
import { AppLogger } from '../logging/app-logger.service';
import { ConfigService } from '@nestjs/config';
import { createAppLoggerMock } from 'src/testing/logger-stub';
import { cast } from 'src/testing/cast';
import type { IGDBGame } from './dto/igdb-get-game.dto';

const axResponse = (data: unknown) => cast<AxiosResponse>({ data });
const axError = (status: number) =>
  cast<Error & { isAxiosError: boolean; response: { status: number } }>({
    name: 'Error',
    message: `http ${status}`,
    isAxiosError: true,
    response: { status },
  });

const configValues: Record<string, unknown> = {
  IGDB_API_HOST: 'https://igdb-host',
  IGDB_API_CLIENT_ID: 'client-id',
  IGDB_API_CLIENT_SECRET: 'client-secret',
  IGDB_OAUTH_URL: 'https://igdb-oauth',
};

describe('IgdbService', () => {
  let appLogger: ReturnType<typeof createAppLoggerMock>;
  let service: IgdbService;
  let postSpy: jest.SpyInstance;

  const seedToken = (): void => {
    const exposed = service as unknown as {
      accessToken: string | null;
      tokenExpiry: number | null;
    };
    exposed.accessToken = 'cached-token';
    exposed.tokenExpiry = Date.now() + 60000;
  };

  beforeEach(() => {
    appLogger = createAppLoggerMock();
    const configService = cast<ConfigService>({
      get: (key: string): unknown => configValues[key],
    });
    service = new IgdbService(
      cast<GameService>({}),
      configService,
      cast<AppLogger>(appLogger),
    );
    postSpy = jest
      .spyOn(axios, 'post')
      .mockImplementation(async () => axResponse([]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('access token handling', () => {
    it('fetches the token once and reuses it for subsequent queries', async () => {
      const tokenBody = {
        access_token: 'token-1',
        expires_in: 3600,
        token_type: 'bearer',
      };
      postSpy
        .mockResolvedValueOnce(axResponse(tokenBody))
        .mockResolvedValueOnce(axResponse([]))
        .mockResolvedValueOnce(axResponse([]));

      await service.queryIGDBByName('uncharted');
      await service.queryIGDBByName('uncharted');

      expect(postSpy).toHaveBeenCalledTimes(3);
      expect(postSpy).toHaveBeenNthCalledWith(
        1,
        'https://igdb-oauth',
        null,
        expect.objectContaining({
          params: {
            client_id: 'client-id',
            client_secret: 'client-secret',
            grant_type: 'client_credentials',
          },
        }),
      );
      expect(postSpy).toHaveBeenNthCalledWith(
        2,
        'https://igdb-host',
        expect.stringContaining('search "uncharted"'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Client-ID': 'client-id',
            Authorization: 'Bearer token-1',
          }),
        }),
      );
    });

    it('refetches the token once it has expired', async () => {
      const exposed = service as unknown as {
        accessToken: string | null;
        tokenExpiry: number | null;
      };
      exposed.accessToken = 'expired-token';
      exposed.tokenExpiry = Date.now() - 1000;

      postSpy
        .mockResolvedValueOnce(
          axResponse({
            access_token: 'token-2',
            expires_in: -1,
            token_type: 'bearer',
          }),
        )
        .mockResolvedValueOnce(axResponse([]))
        .mockResolvedValueOnce(
          axResponse({
            access_token: 'token-3',
            expires_in: -1,
            token_type: 'bearer',
          }),
        )
        .mockResolvedValueOnce(axResponse([]));

      await service.queryIGDBByName('a');
      await service.queryIGDBByName('b');

      expect(postSpy).toHaveBeenCalledTimes(4);
      expect(postSpy).toHaveBeenCalledWith(
        'https://igdb-oauth',
        null,
        expect.anything(),
      );
    });
  });

  describe('queryIGDBByName', () => {
    it('builds the default query and returns raw games', async () => {
      seedToken();
      const games: IGDBGame[] = [{ id: 1, name: 'Uncharted' }];
      postSpy.mockResolvedValue(axResponse(games));

      const result = await service.queryIGDBByName('uncharted');

      expect(postSpy).toHaveBeenCalledWith(
        'https://igdb-host',
        expect.stringContaining(
          'game_type != 5 & game_type != 3 & release_dates.date_format=0',
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer cached-token',
          }),
        }),
      );
      expect(result).toEqual(games);
    });

    it('adds the year to the where clause and filters by earliest release year', async () => {
      seedToken();
      postSpy.mockResolvedValue(
        axResponse([
          {
            id: 1,
            name: 'Uncharted 4',
            release_dates: [{ date: 1451606400 }],
          },
          {
            id: 2,
            name: 'Uncharted Collection',
            release_dates: [{ date: 1300000000 }],
          },
        ]),
      );

      const result = await service.queryIGDBByName('uncharted', {
        year: 2016,
        limit: 100,
      });

      expect(postSpy).toHaveBeenCalledWith(
        'https://igdb-host',
        expect.stringContaining('release_dates.y = 2016'),
        expect.anything(),
      );
      expect(postSpy).toHaveBeenCalledWith(
        'https://igdb-host',
        expect.stringContaining('limit 100;'),
        expect.anything(),
      );
      expect(result.map((game) => game.id)).toEqual([1]);
    });

    it('swallows non-429 API errors and returns an empty list', async () => {
      seedToken();
      postSpy.mockRejectedValue(axError(500));

      await expect(service.queryIGDBByName('uncharted')).resolves.toEqual([]);
      expect(appLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to querying IGDB by name'),
      );
    });

    it('rethrows 429 rate-limit errors', async () => {
      seedToken();
      postSpy.mockRejectedValue(axError(429));

      await expect(service.queryIGDBByName('uncharted')).rejects.toMatchObject({
        response: { status: 429 },
      });
    });
  });

  describe('queryIGDBById', () => {
    it('queries by id with the search fields', async () => {
      seedToken();
      const games: IGDBGame[] = [{ id: 123, name: 'Game' }];
      postSpy.mockResolvedValue(axResponse(games));

      const result = await service.queryIGDBById(123);

      expect(postSpy).toHaveBeenCalledWith(
        'https://igdb-host',
        expect.stringContaining('where id=123;'),
        expect.anything(),
      );
      expect(result).toEqual(games);
    });
  });

  describe('getIGDBGameById', () => {
    it('returns the first game found', async () => {
      seedToken();
      postSpy.mockResolvedValue(axResponse([{ id: 1, name: 'Game' }]));

      await expect(service.getIGDBGameById(1)).resolves.toEqual({
        id: 1,
        name: 'Game',
      });
    });

    it('returns null when no game matches the id', async () => {
      seedToken();
      postSpy.mockResolvedValue(axResponse([]));

      await expect(service.getIGDBGameById(1)).resolves.toBeNull();
      expect(appLogger.warn).toHaveBeenCalledWith(
        'No IGDB game found for ID "1"',
      );
    });

    it('returns null and logs on non-429 API errors', async () => {
      seedToken();
      postSpy.mockRejectedValue(axError(500));

      await expect(service.getIGDBGameById(1)).resolves.toBeNull();
      expect(appLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get IGDB game by ID'),
      );
    });

    it('rethrows 429 rate-limit errors', async () => {
      seedToken();
      postSpy.mockRejectedValue(axError(429));

      await expect(service.getIGDBGameById(1)).rejects.toMatchObject({
        response: { status: 429 },
      });
    });
  });

  describe('findGamesByNames', () => {
    it('dedupes names, picks the best-rated match and keeps the original order', async () => {
      seedToken();
      const zeldaList = [
        { id: 1, name: 'Zelda', total_rating_count: 10 },
        { id: 2, name: 'Zelda', total_rating_count: 500 },
      ];
      const metroidList = [{ id: 3, name: 'Metroid', total_rating_count: 90 }];
      postSpy
        .mockResolvedValueOnce(axResponse(zeldaList))
        .mockResolvedValueOnce(axResponse(metroidList));

      const result = await service.findGamesByNames([
        'Zelda',
        'Zelda',
        'Metroid',
      ]);

      expect(postSpy).toHaveBeenCalledTimes(2);
      expect(result.map((game) => game.id)).toEqual([2, 3]);
    });

    it('matches games through their alternative names', async () => {
      seedToken();
      const list = [
        {
          id: 7,
          name: 'Some Long Title',
          alternative_names: [{ id: 1, name: 'alias-1' }],
          total_rating_count: 3,
        },
      ];
      postSpy.mockResolvedValue(axResponse(list));

      const result = await service.findGamesByNames(['Alias-1']);

      expect(result.map((game) => game.id)).toEqual([7]);
    });

    it('retries up to three times on 429 responses', async () => {
      seedToken();
      jest.useFakeTimers();
      try {
        postSpy.mockRejectedValue(axError(429));

        const promise = service.findGamesByNames(['Zelda']);
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(postSpy).toHaveBeenCalledTimes(3);
        expect(result).toEqual([]);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
