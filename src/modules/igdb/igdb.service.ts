import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import type { IGDBGame } from './dto/igdb-get-game.dto';
import axios, { type AxiosResponse } from 'axios';
import { normalizeGameName } from '../../helpers/string/string.helper';
import { GameService } from '../game/game.service';
import { AppLogger } from '../logging/app-logger.service';

@Injectable()
export class IgdbService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  private readonly logger = new Logger(IgdbService.name);

  private readonly apiHost = process.env.IGDB_API_HOST || '';
  private readonly apiClientId = process.env.IGDB_API_CLIENT_ID || '';
  private readonly apiClientSecret = process.env.IGDB_API_CLIENT_SECRET || '';
  private readonly oauthUrl = process.env.IGDB_OAUTH_URL || '';

  constructor(
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    private readonly appLogger: AppLogger,
  ) {}

  /**
   * Look up candidate game names against IGDB and return the matched games
   * in the original order of the provided names.
   */
  async findGamesByNames(names: string[]): Promise<IGDBGame[]> {
    this.appLogger.log(
      `Searching games for candidate names: "${names.join(', ')}"`,
    );

    const uniqueNames = [...new Set(names)];

    const foundGameIds = new Set<number>();
    const foundGames: IGDBGame[] = [];

    for (const name of uniqueNames) {
      try {
        let games: IGDBGame[] = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            games = await this.queryIGDBByName(name);
            break;
          } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 429) {
              await new Promise((resolve) => setTimeout(resolve, 300));
              continue;
            }
            throw error;
          }
        }
        const foundGame = this._findGameInList(name, games);

        if (foundGame) {
          if (foundGameIds.has(foundGame.id)) continue;

          foundGameIds.add(foundGame.id);
          foundGames.push(foundGame);
        }
      } catch (error) {
        if (error instanceof Error) {
          this.appLogger.warn(
            `Failed to query IGDB for "${name}": ${error.message}`,
          );
        } else {
          this.appLogger.warn(
            `Failed to query IGDB for "${name}": Unknown error`,
            error,
          );
        }
      }
    }

    this.appLogger.log(
      `Total games found: ${foundGames.length} : ${foundGames
        .map((g) => g.name)
        .join(', ')}`,
    );

    return foundGames;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && now < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response: AxiosResponse<{
        access_token: string;
        expires_in: number;
        token_type: string;
      }> = await axios.post(this.oauthUrl, null, {
        params: {
          client_id: this.apiClientId,
          client_secret: this.apiClientSecret,
          grant_type: 'client_credentials',
        },
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + response.data.expires_in * 1000;

      this.appLogger.log('IGDB access token fetched successfully');
      return this.accessToken;
    } catch (error) {
      this.appLogger.error('Failed to get IGDB access token', error);
      throw error;
    }
  }

  public async queryIGDBByName(name: string): Promise<IGDBGame[]> {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        this.apiHost,
        `search "${name}"; 
        fields
          id,
          game_type,
          name,
          total_rating_count,
          alternative_names.name,
          release_dates.date,
          involved_companies.company.name,
          cover.url,
          screenshots.url;
      limit 50;
      where game_type != 5 & game_type != 3 & release_dates.date_format=0;`,
        {
          headers: {
            'Client-ID': this.apiClientId,
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data as IGDBGame[];
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        this.appLogger.warn(
          `Failed to query IGDB for "${name}": ${error.message}`,
        );
      } else if (error instanceof Error) {
        this.appLogger.warn(
          `Failed to query IGDB for "${name}": ${error.message}`,
        );
      } else {
        this.appLogger.warn(
          `Failed to query IGDB for "${name}": Unknown error`,
        );
      }
      return [];
    }
  }

  public async getIGDBGameById(id: number): Promise<IGDBGame | null> {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        this.apiHost,
        `fields
          id,
          game_type,
          name,
          release_dates.date,
          involved_companies.company.name,
          cover.url,
          screenshots.url;
        where id=${id};`,
        {
          headers: {
            'Client-ID': this.apiClientId,
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const games = response.data as IGDBGame[];
      if (games.length === 0) {
        this.appLogger.warn(`No IGDB game found for ID "${id}"`);
        return null;
      }
      return games[0];
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        this.appLogger.warn(
          `Failed to get IGDB game by ID "${id}": ${error.message}`,
        );
      } else if (error instanceof Error) {
        this.appLogger.warn(
          `Failed to get IGDB game by ID "${id}": ${error.message}`,
        );
      } else {
        this.appLogger.warn(
          `Failed to get IGDB game by ID "${id}": Unknown error`,
        );
      }
      return null;
    }
  }

  private _findGameInList(
    gameName: string,
    gameList: IGDBGame[],
  ): IGDBGame | null {
    const normalizedTarget = normalizeGameName(gameName);

    const matchingGames: IGDBGame[] = [];
    for (const game of gameList) {
      if (normalizeGameName(game.name) === normalizedTarget) {
        matchingGames.push(game);
      } else if (
        game.alternative_names?.some(
          (alt) => normalizeGameName(alt.name) === normalizedTarget,
        )
      ) {
        matchingGames.push(game);
      }
    }

    if (matchingGames.length > 0) {
      matchingGames.sort(
        (a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0),
      );
      return matchingGames[0];
    }

    return null;
  }
}
