import axios, { AxiosResponse } from 'axios';
import { DeepseekService } from './deepseek.service';
import { AppLogger } from '../logging/app-logger.service';
import { ConfigService } from '@nestjs/config';
import { createAppLoggerMock } from 'src/testing/logger-stub';
import { cast } from 'src/testing/cast';
import { DEFAULT_GAME_CANDIDATE_AI_PROMPT } from './game-candidate.prompt';

const axResponse = (content: unknown) =>
  cast<AxiosResponse>({
    data: { choices: [{ message: { content } }] },
  });
const axError = (status: number) =>
  cast<Error & { isAxiosError: boolean; response: { status: number } }>({
    name: 'Error',
    message: `http ${status}`,
    isAxiosError: true,
    response: { status },
  });

const baseConfig: Record<string, unknown> = {
  DEEPSEEK_API_HOST: 'https://deepseek',
  DEEPSEEK_API_KEY: 'deepseek-key',
  DEEPSEEK_MODEL: 'test-model',
};

describe('DeepseekService', () => {
  let appLogger: ReturnType<typeof createAppLoggerMock>;
  let postSpy: jest.SpyInstance;

  const makeService = (
    config: Record<string, unknown> = baseConfig,
  ): DeepseekService => {
    const configService = cast<ConfigService>({
      get: (key: string): unknown => config[key],
    });
    return new DeepseekService(configService, cast<AppLogger>(appLogger));
  };

  beforeEach(() => {
    appLogger = createAppLoggerMock();
    postSpy = jest
      .spyOn(axios, 'post')
      .mockImplementation(async () => axResponse([]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractMainGameNames', () => {
    it('throws when the API key is not configured', async () => {
      const service = makeService({ DEEPSEEK_API_KEY: '' });

      await expect(
        service.extractMainGameNames(
          DEFAULT_GAME_CANDIDATE_AI_PROMPT,
          't',
          'd',
        ),
      ).rejects.toThrow('DEEPSEEK_API_KEY is not configured');
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('posts the system prompt and user content and returns a parsed array', async () => {
      const service = makeService();
      postSpy.mockResolvedValue(axResponse('["Uncharted 4"]'));

      const result = await service.extractMainGameNames(
        DEFAULT_GAME_CANDIDATE_AI_PROMPT,
        'Video title',
        'Some description',
      );

      expect(postSpy).toHaveBeenCalledWith(
        'https://deepseek/chat/completions',
        expect.objectContaining({
          model: 'test-model',
          messages: [
            { role: 'system', content: DEFAULT_GAME_CANDIDATE_AI_PROMPT },
            {
              role: 'user',
              content: 'Title:\nVideo title\n\nDescription:\nSome description',
            },
          ],
          response_format: { type: 'json_object' },
          thinking: { type: 'disabled' },
          max_tokens: 512,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer deepseek-key',
          }),
        }),
      );
      expect(result).toEqual(['Uncharted 4']);
      expect(appLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('1 main game(s)'),
      );
    });

    it('caps the description at 3000 characters', async () => {
      const service = makeService();
      const longDescription = 'x'.repeat(4000);
      let userContent: unknown;
      postSpy.mockImplementation(
        async (
          _url: unknown,
          body: { messages: { role: string; content: string }[] },
        ) => {
          userContent = body.messages.find(
            (message) => message.role === 'user',
          )?.content;
          return axResponse('[]');
        },
      );

      await service.extractMainGameNames(
        DEFAULT_GAME_CANDIDATE_AI_PROMPT,
        't',
        longDescription,
      );

      expect(String(userContent)).toContain('x'.repeat(3000));
      expect(String(userContent)).not.toContain('x'.repeat(3001));
    });

    it('parses a wrapped games object response', async () => {
      const service = makeService();
      postSpy.mockResolvedValue(axResponse('{"games": ["Halo", "Doom"]}'));

      await expect(
        service.extractMainGameNames('p', 't', 'd'),
      ).resolves.toEqual(['Halo', 'Doom']);
    });

    it('returns an empty list when the model answers without content', async () => {
      const service = makeService();
      postSpy.mockResolvedValue(
        cast<AxiosResponse>({ data: { choices: [{}] } }),
      );

      await expect(
        service.extractMainGameNames('p', 't', 'd'),
      ).resolves.toEqual([]);
    });

    it('returns an empty list for unparsable content', async () => {
      const service = makeService();
      postSpy.mockResolvedValue(axResponse('not json at all'));

      await expect(
        service.extractMainGameNames('p', 't', 'd'),
      ).resolves.toEqual([]);
      expect(appLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unparsable content'),
      );
    });

    it('rethrows non-rate-limit failures', async () => {
      const service = makeService();
      postSpy.mockRejectedValue(new Error('gateway down'));

      await expect(service.extractMainGameNames('p', 't', 'd')).rejects.toThrow(
        'gateway down',
      );
    });

    it('retries three times on 429 responses then gives up', async () => {
      const service = makeService();
      jest.useFakeTimers();
      try {
        postSpy.mockRejectedValue(axError(429));

        const promise = service.extractMainGameNames('p', 't', 'd');
        const expectation = expect(promise).rejects.toThrow(
          'DeepSeek request failed after 3 attempts',
        );
        await jest.runAllTimersAsync();
        await expectation;

        expect(postSpy).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
