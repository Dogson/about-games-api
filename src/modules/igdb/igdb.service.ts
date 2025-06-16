import { Injectable, Logger } from '@nestjs/common';
import type { IGDBGame } from './dto/igdb-get-game.dto';
import axios, { type AxiosResponse } from 'axios';
import {
  normalizeString,
  removeAllAccents,
  removeAllWhitespaces,
  removeMatchesFromString,
} from '../../helpers/string/string.helper';
import { GameService } from '../game/game.service';

@Injectable()
export class IgdbService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  private readonly logger = new Logger(IgdbService.name);

  private readonly apiHost = process.env.IGDB_API_HOST || '';
  private readonly apiClientId = process.env.IGDB_API_CLIENT_ID || '';
  private readonly apiClientSecret = process.env.IGDB_API_CLIENT_SECRET || '';
  private readonly oauthUrl = process.env.IGDB_OAUTH_URL || '';

  constructor(private readonly gameService: GameService) {}

  /**
   * Public method to extract mentioned games from a paragraph
   */
  async extractMentionedGames(description: string): Promise<IGDBGame[]> {
    const candidateNames = this.extractTitleCandidates(description);

    const uniqueNames = [...new Set(candidateNames)];

    this.logger.log(
      `Found ${uniqueNames.length} candidate game titles : ${uniqueNames.join(', ')}`,
    );

    const foundGames: IGDBGame[] = [];

    for (const name of uniqueNames) {
      try {
        const games = await this.queryIGDBByName(name);
        this.logger.log(
          `Queried IGDB for "${name}", found ${games.length} results`,
        );

        const foundGame = this._findGameInList(name, games);

        const shouldIgnoreGame =
          !!foundGame &&
          (
            await this.gameService.findAll({
              ignoreDuringSearch: true,
              limit: 1000,
              igdbId: foundGame?.id,
            })
          ).total > 0;

        if (shouldIgnoreGame) {
          this.logger.log(`Ignoring game "${foundGame.name}"`);
        }

        if (foundGame && !shouldIgnoreGame) {
          foundGames.push(foundGame);
        }
      } catch (error) {
        if (error instanceof Error) {
          this.logger.warn(
            `Failed to query IGDB for "${name}": ${error.message}`,
          );
        } else {
          this.logger.warn(
            `Failed to query IGDB for "${name}": Unknown error`,
            error,
          );
        }
      }
    }

    // Filter out games that are substrings of other games
    const foundGamesWithoutUnrelevant = foundGames.filter((game) => {
      const lowerStr = game.name.toLowerCase();
      // keep the string only if no other string contains it (and it's not the same string)
      return !foundGames.some(
        (otherGame) =>
          otherGame.name.toLowerCase() !== lowerStr &&
          otherGame.name.toLowerCase().includes(lowerStr),
      );
    });

    this.logger.log(
      `Total games found: ${foundGamesWithoutUnrelevant.length} : ${foundGamesWithoutUnrelevant
        .map((g) => g.name)
        .join(', ')}`,
    );
    return foundGamesWithoutUnrelevant;
  }

  /**
   * Naive NLP approach: extract capitalized sequences that could be game titles
   */
  private extractTitleCandidates(text: string): string[] {
    const multiWordCandidates = new Set<string>();
    const singleWordCandidates = new Set<string>();
    let match: RegExpExecArray | null;

    // 0. Remove timestamps from the text
    const timestampRegex = /\b\d+(?::\d+)+\b/g;
    const cleanedText = removeMatchesFromString(text, timestampRegex);

    // 1. Quoted titles (assumed multi-word)
    const quotedTitleRegex = /["“'”]([^"“'”\n]{2,})["”']/g;
    while ((match = quotedTitleRegex.exec(cleanedText)) !== null) {
      multiWordCandidates.add(match[1].trim());
    }

    // 2. Compound titles with lowercase connectors and optional numbers
    const titleRegex = new RegExp(
      String.raw`\b(` +
        String.raw`(?:\d+[:]?|[A-Z][a-z0-9'’:-]*|[A-Z]{2,})` + // Capitalized, ALL CAPS, or numbers
        String.raw`(?:` +
        String.raw`(?:\s+[a-z]{1,4})+` + // small lowercase words in between
        String.raw`\s+(?:\d+[:]?|[A-Z][a-z0-9'’:-]*|[A-Z]{2,})` + // another unit (number, Capitalized, or ALL CAPS)
        String.raw`|` +
        String.raw`\s+(?:\d+[:]?|[A-Z][a-z0-9'’:-]*|[A-Z]{2,})` +
        String.raw`)+` +
        String.raw`)\b`,
      'g',
    );

    while ((match = titleRegex.exec(cleanedText)) !== null) {
      multiWordCandidates.add(match[1].trim());
    }

    // 3. Track words inside multi-word titles to avoid duplication
    const wordsInsideMultiWordTitles = new Set<string>();
    for (const title of multiWordCandidates) {
      const words = title.split(/[\s:’‘'"-]+/).filter(Boolean);
      words.forEach((w) => wordsInsideMultiWordTitles.add(w.toLowerCase()));
    }

    // 4. Fallback to single capitalized or numeric words
    const singleWordTitleRegex = /\b(?:\d+|[A-Z][a-z]{3,})\b/g;
    while ((match = singleWordTitleRegex.exec(cleanedText)) !== null) {
      const word = match[0];
      if (!wordsInsideMultiWordTitles.has(word.toLowerCase())) {
        singleWordCandidates.add(word);
      }
    }

    // 5. Combine and return
    const combined = new Set([...multiWordCandidates, ...singleWordCandidates]);

    // 6. Look for patterns like "[Title1] and [Title2]"
    const connectorWords = ['and', 'vs', 'or', '&', 'et', 'ou', "it's", "It's"];
    const combinedTitles = Array.from(combined);

    for (const title of combinedTitles) {
      for (const connector of connectorWords) {
        const pattern = new RegExp(`^(.+?)\\s+${connector}\\s+(.+)$`, 'i');
        const match = pattern.exec(title);
        if (match) {
          const [, left, right] = match;
          // Trim and ensure both sides look like valid sub-titles (basic check)
          if (left.length > 2 && right.length > 2) {
            combined.add(left.trim());
            combined.add(right.trim());
            combined.add(title.trim()); // already in, but harmless to re-add
          }
        }
      }
    }

    // 7. Generate all contiguous substrings of multi-word titles and add them
    const expanded = new Set<string>();
    for (const title of combined) {
      const words = title.split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        expanded.add(title);
      } else {
        // Generate all contiguous substrings of words with length >=1
        for (let start = 0; start < words.length; start++) {
          for (let end = start + 1; end <= words.length; end++) {
            const substring = words.slice(start, end).join(' ');
            if (substring.length > 1) expanded.add(substring);
          }
        }
      }
    }

    return Array.from(expanded);
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

      this.logger.log('IGDB access token fetched successfully');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Failed to get IGDB access token', error);
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
          category,
          name,
          total_rating_count,
          alternative_names.name,
          release_dates.date,
          involved_companies.company.name,
          cover.url,
          screenshots.url;
      limit 50;
      where category != 5 & category != 3 & release_dates.date_format=0;`,
        {
          headers: {
            'Client-ID': this.apiClientId,
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data as IGDBGame[];
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logger.warn(
          `Failed to query IGDB for "${name}": ${error.message}`,
        );
      } else if (error instanceof Error) {
        this.logger.warn(
          `Failed to query IGDB for "${name}": ${error.message}`,
        );
      } else {
        this.logger.warn(`Failed to query IGDB for "${name}": Unknown error`);
      }
      return [];
    }
  }

  private _findGameInList(
    gameName: string,
    gameList: IGDBGame[],
  ): IGDBGame | null {
    const normalizedTarget = removeAllAccents(
      removeAllWhitespaces(normalizeString(gameName)),
    );

    const matchingGames: IGDBGame[] = [];
    for (const game of gameList) {
      if (
        removeAllAccents(removeAllWhitespaces(normalizeString(game.name))) ===
        normalizedTarget
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
