import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_GAME_CANDIDATE_AI_PROMPT } from './game-candidate.prompt';
import { AppLogger } from '../logging/app-logger.service';

interface ChatCompletionMessage {
  role: string;
  content: string;
}

interface ChatCompletionResponse {
  choices?: {
    message?: {
      content?: unknown;
    };
  }[];
}

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);

  private readonly apiHost: string;
  private readonly apiKey: string;
  private readonly model: string;

  private readonly descriptionMaxChars = 3000;

  constructor(
    private readonly configService: ConfigService,
    private readonly appLogger: AppLogger,
  ) {
    this.apiHost =
      this.configService.get<string>('DEEPSEEK_API_HOST') ||
      'https://api.deepseek.com';
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    this.model =
      this.configService.get<string>('DEEPSEEK_MODEL') || 'deepseek-v4-flash';
  }

  /**
   * Ask the model to extract the main game titles from a video title + description.
   * Returns the game names ordered by prominence (most important first).
   * Throws on any API failure so callers can decide how to handle it.
   */
  async extractMainGameNames(
    prompt: string,
    title: string,
    description: string,
  ): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const systemPrompt = prompt?.trim() || DEFAULT_GAME_CANDIDATE_AI_PROMPT;
    const cappedDescription = description.slice(0, this.descriptionMaxChars);

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Title:\n${title}\n\nDescription:\n${cappedDescription}`,
      },
    ];

    const response = await this._postWithRetry(messages);

    const content = response.data?.choices?.[0]?.message?.content;

    const gameNames = this._parseGameNames(content);

    this.appLogger.log(
      `DeepSeek extracted ${gameNames.length} main game(s): ${gameNames.join(', ')}`,
    );

    return gameNames;
  }

  private async _postWithRetry(
    messages: ChatCompletionMessage[],
  ): Promise<AxiosResponse<ChatCompletionResponse>> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await axios.post<ChatCompletionResponse>(
          `${this.apiHost}/chat/completions`,
          {
            model: this.model,
            messages,
            response_format: { type: 'json_object' },
            thinking: { type: 'disabled' },
            max_tokens: 512,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
          },
        );
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        throw error;
      }
    }
    throw new Error('DeepSeek request failed after 3 attempts');
  }

  private _parseGameNames(content: unknown): string[] {
    if (typeof content !== 'string' || content.trim().length === 0) {
      return [];
    }

    const parseJson = (json: string): string[] | null => {
      try {
        const parsed = JSON.parse(json) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((x): x is string => typeof x === 'string');
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { games?: unknown }).games)
        ) {
          return (parsed as { games: unknown[] }).games.filter(
            (x): x is string => typeof x === 'string',
          );
        }
      } catch {
        return null;
      }
      return [];
    };

    const direct = parseJson(content);
    if (direct !== null) return direct;

    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const extracted = parseJson(arrayMatch[0]);
      if (extracted !== null) return extracted;
    }

    this.appLogger.warn(
      `DeepSeek returned unparsable content for game extraction: "${content.slice(0, 200)}"`,
    );
    return [];
  }
}
