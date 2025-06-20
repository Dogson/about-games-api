import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
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

  constructor(
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
  ) {}

  /**
   * Public method to extract mentioned games from a paragraph
   */
  async extractMentionedGames(
    stringToParse: string,
    ignoreSearchIn: string[] = [],
    endParsingAfter: string[] = [],
  ): Promise<IGDBGame[]> {
    this.logger.log(`Parsing string for game titles: "${stringToParse}"`);

    const candidateNames = this.extractTitleCandidates(
      stringToParse,
      ignoreSearchIn,
      endParsingAfter,
    );

    const uniqueNames = [...new Set(candidateNames)];

    const allFoundGames: IGDBGame[] = [];
    const usedNames = new Set<string>();

    // Trier par longueur décroissante
    const sortedNames = [...uniqueNames].sort((a, b) => b.length - a.length);

    for (const name of sortedNames) {
      const normalized = removeAllAccents(
        removeAllWhitespaces(normalizeString(name)),
      );

      // Ignorer si ce nom est déjà couvert par un nom plus long déjà utilisé
      const isSubOfUsed = Array.from(usedNames).some((used) =>
        used.includes(normalized),
      );
      if (isSubOfUsed) continue;

      try {
        const games = await this.queryIGDBByName(name);
        const foundGame = this._findGameInList(name, games);

        if (foundGame) {
          const shouldIgnoreGame =
            (
              await this.gameService.findAll({
                ignoreDuringSearch: true,
                limit: 1000,
                igdbId: foundGame.id,
              })
            ).total > 0;

          if (shouldIgnoreGame) {
            this.logger.log(`Ignoring game "${foundGame.name}"`);
            continue;
          }

          usedNames.add(normalized);
          allFoundGames.push(foundGame);
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
    const foundGamesWithoutUnrelevant = allFoundGames.filter((game) => {
      const lowerStr = game.name.toLowerCase();
      // keep the string only if no other string contains it (and it's not the same string)
      return !allFoundGames.some(
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
  private extractTitleCandidates(
    text: string,
    ignoreSearchIn: string[] = [],
    endParsingAfter: string[] = [],
  ): string[] {
    const multiWordCandidates = new Set<string>();
    const singleWordCandidates = new Set<string>();
    let match: RegExpExecArray | null;

    // === 0. Compile ignoreSearchIn and endParsingAfter patterns ===
    const compileRegex = (patternStr: string): RegExp => {
      const regexMatch = patternStr.match(/^\/(.+)\/([gimsuy]*)$/);
      if (regexMatch) {
        try {
          return new RegExp(regexMatch[1], regexMatch[2]);
        } catch {
          return /a^/; // invalid pattern fallback
        }
      }
      return /a^/;
    };

    const ignoreSearchPatterns = ignoreSearchIn.map(compileRegex);
    const endParsingPatterns = endParsingAfter.map(compileRegex);

    // === 1. Apply `endParsingAfter` truncation ===
    for (const pattern of endParsingPatterns) {
      const match = pattern.exec(text);
      if (match && match.index !== undefined) {
        text = text.slice(0, match.index + match[0].length);
        break; // only apply the first match
      }
    }

    // === 2. Remove timestamps ===
    const timestampRegex = /\b\d+(?::\d+)+\b/g;
    let cleanedText = removeMatchesFromString(text, timestampRegex);

    // === 3. Remove substrings matching `ignoreSearchIn` ===
    for (const pattern of ignoreSearchPatterns) {
      cleanedText = removeMatchesFromString(cleanedText, pattern);
    }

    // === 3.5 Strip dots from cleanedText ===
    cleanedText = cleanedText.replace(/\./g, '');

    // === 4. Extract quoted titles ===
    const quotedTitleRegex = /["“'”]([^"“'”\n]{2,})["”']/g;
    while ((match = quotedTitleRegex.exec(cleanedText)) !== null) {
      multiWordCandidates.add(match[1].trim());
    }

    // === 5. Extract compound capitalized/numeric patterns ===
    const titleRegex = new RegExp(
      String.raw`\b(` +
        String.raw`(?:\d+[:]?|[A-Z][a-z0-9'’:-]*|[A-Z]{2,})` +
        String.raw`(?:` +
        String.raw`(?:\s+[a-z]{1,4})+` +
        String.raw`\s+(?:\d+[:]?|[A-Z][a-z0-9'’:-]*|[A-Z]{2,})` +
        String.raw`|` +
        String.raw`\s+(?:\d+[:]?|[A-Z][a-z0-9'’:-]*|[A-Z]{2,})` +
        String.raw`)+` +
        String.raw`)\b`,
      'g',
    );

    while ((match = titleRegex.exec(cleanedText)) !== null) {
      const candidate = match[1].trim();
      const words = candidate.split(/\s+/);
      const lastWord = words[words.length - 1];

      // Ignore si le dernier mot est tout en minuscules (au moins 3 lettres) et non dans la whitelist
      const allowedLowercaseWords = ['of', 'the', 'in', 'and', 'to'];
      if (
        !/^[a-z]{3,}$/.test(lastWord) ||
        allowedLowercaseWords.includes(lastWord)
      ) {
        multiWordCandidates.add(candidate);
      }
    }

    // === 6. Track words in multi-word titles ===
    const wordsInsideMultiWordTitles = new Set<string>();
    for (const title of multiWordCandidates) {
      const words = title.split(/[\s:’‘'"-]+/).filter(Boolean);
      words.forEach((w) => wordsInsideMultiWordTitles.add(w.toLowerCase()));
    }

    // === 7. Fallback to single capitalized or numeric words ===
    const singleWordTitleRegex = /\b(?:\d+|[A-Z]{2,}|[A-Z][a-z]{3,})\b/g;
    while ((match = singleWordTitleRegex.exec(cleanedText)) !== null) {
      const word = match[0];
      if (!wordsInsideMultiWordTitles.has(word.toLowerCase())) {
        singleWordCandidates.add(word);
      }
    }

    // === 8. Combine sets ===
    const combined = new Set([...multiWordCandidates, ...singleWordCandidates]);

    // === 9. Split compound titles like "A and B" ===
    const connectorWords = ['and', 'vs', 'or', '&', 'et', 'ou', "it's", "It's"];
    const combinedTitles = Array.from(combined);

    for (const title of combinedTitles) {
      for (const connector of connectorWords) {
        const pattern = new RegExp(`^(.+?)\\s+${connector}\\s+(.+)$`, 'i');
        const match = pattern.exec(title);
        if (match) {
          const [, left, right] = match;
          if (left.length > 2 && right.length > 2) {
            combined.add(left.trim());
            combined.add(right.trim());
          }
        }
      }
    }

    // === 10. Expand contiguous substrings ===
    const expanded = new Set<string>();

    for (const title of combined) {
      const words = title.split(/\s+/).filter(Boolean);

      if (words.length <= 1) {
        const word = words[0];
        if (word && word[0] === word[0].toUpperCase()) {
          expanded.add(word);
        }
      } else {
        for (let start = 0; start < words.length; start++) {
          for (let end = start + 1; end <= words.length; end++) {
            const slice = words.slice(start, end);
            const first = slice[0];
            const last = slice[slice.length - 1];

            if (
              first &&
              last &&
              first[0] === first[0].toUpperCase() &&
              last[0] === last[0].toUpperCase()
            ) {
              expanded.add(slice.join(' '));
            }
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

  public async getIGDBGameById(id: number): Promise<IGDBGame | null> {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        this.apiHost,
        `fields
          id,
          category,
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
        this.logger.warn(`No IGDB game found for ID "${id}"`);
        return null;
      }
      return games[0];
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logger.warn(
          `Failed to get IGDB game by ID "${id}": ${error.message}`,
        );
      } else if (error instanceof Error) {
        this.logger.warn(
          `Failed to get IGDB game by ID "${id}": ${error.message}`,
        );
      } else {
        this.logger.warn(
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
      } else if (
        game.alternative_names?.some(
          (alt) =>
            removeAllAccents(
              removeAllWhitespaces(normalizeString(alt.name)),
            ) === normalizedTarget,
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
