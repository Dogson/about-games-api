import axios, { AxiosResponse } from 'axios';
import { HttpException } from '@nestjs/common';
import { YoutubeService } from './youtube.service';
import { ConfigService } from '@nestjs/config';
import { cast } from 'src/testing/cast';

const configValues: Record<string, unknown> = {
  YOUTUBE_API_KEY: 'yt-key',
  YOUTUBE_API_HOST: 'https://www.googleapis.com/youtube/v3/',
};

function makeService(
  values: Record<string, unknown> = configValues,
): YoutubeService {
  const configService = cast<ConfigService>({
    get: (key: string): unknown => values[key],
  });
  return new YoutubeService(configService);
}

function axGetResponse(
  url: string,
  status: number,
  headers: Record<string, string> = {},
): AxiosResponse {
  return cast<AxiosResponse>({
    status,
    headers,
    config: { url },
    data: {},
  });
}

const expectHttpStatus = async (
  promise: Promise<unknown>,
  status: number,
): Promise<void> => {
  try {
    await promise;
    throw new Error('expected an HttpException but none was thrown');
  } catch (error: unknown) {
    if (error instanceof HttpException) {
      expect(error.getStatus()).toBe(status);
      return;
    }
    throw error;
  }
};

describe('YoutubeService', () => {
  let getSpy: jest.SpyInstance;
  const host = 'https://www.googleapis.com/youtube/v3/';

  beforeEach(() => {
    getSpy = jest
      .spyOn(axios, 'get')
      .mockImplementation(async () =>
        cast<AxiosResponse>({ status: 200, data: {}, headers: {}, config: {} }),
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('_getYtChannelInfosByIdOrHandle', () => {
    it('throws an internal error when the API is not configured', async () => {
      const service = makeService({
        YOUTUBE_API_KEY: '',
        YOUTUBE_API_HOST: '',
      });
      await expectHttpStatus(service.getYtChannelInfosById('UC'), 500);
    });

    it('fetches channel infos by id', async () => {
      const service = makeService();
      getSpy.mockResolvedValue(
        cast<AxiosResponse>({
          status: 200,
          headers: {},
          config: {},
          data: { items: [{ id: 'UC', snippet: {} }] },
        }),
      );

      const channel = await service.getYtChannelInfosById('UC');

      expect(getSpy).toHaveBeenCalledWith(`${host}channels`, {
        params: expect.objectContaining({
          key: 'yt-key',
          part: 'snippet,statistics,contentDetails',
          id: 'UC',
        }),
      });
      expect(channel.id).toBe('UC');
    });

    it('strips the leading @ when fetching by handle', async () => {
      const service = makeService();
      getSpy.mockResolvedValue(
        cast<AxiosResponse>({
          status: 200,
          headers: {},
          config: {},
          data: { items: [{ id: 'UC', snippet: {} }] },
        }),
      );

      await service.getYtChannelInfosByHandle('@my-channel');

      expect(getSpy).toHaveBeenCalledWith(`${host}channels`, {
        params: expect.objectContaining({ forHandle: 'my-channel' }),
      });
    });

    it('falls back to a generic 500 when no channel item is returned', async () => {
      const service = makeService();
      getSpy.mockResolvedValue(
        cast<AxiosResponse>({
          status: 200,
          headers: {},
          config: {},
          data: { items: [] },
        }),
      );

      await expectHttpStatus(service.getYtChannelInfosById('UC'), 500);
    });

    it('translates YouTube API errors into HttpExceptions', async () => {
      const service = makeService();
      getSpy.mockRejectedValue(
        cast<never>({
          isAxiosError: true,
          response: {
            status: 403,
            data: { error: { message: 'quota exceeded' } },
          },
        }),
      );

      try {
        await service.getYtChannelInfosByHandle('my-channel');
        throw new Error('expected an HttpException');
      } catch (error: unknown) {
        if (error instanceof HttpException) {
          expect(error.getStatus()).toBe(403);
          expect(error.message).toContain('quota exceeded');
        } else {
          throw error;
        }
      }
    });
  });

  describe('getAllVideosFromChannel', () => {
    it('throws an internal error when the API is not configured', async () => {
      const service = makeService({
        YOUTUBE_API_KEY: '',
        YOUTUBE_API_HOST: '',
      });
      await expectHttpStatus(service.getAllVideosFromChannel('UU'), 500);
    });

    it('paginates through the playlist and keeps videos with a high-res thumbnail', async () => {
      const service = makeService();
      const item = (videoId: string, hasThumb: boolean): unknown => ({
        snippet: {
          title: `title-${videoId}`,
          description: `desc-${videoId}`,
          publishedAt: '2020-01-01',
          resourceId: { videoId },
          thumbnails: hasThumb
            ? { high: { url: `https://thumb/${videoId}` } }
            : {},
        },
      });
      getSpy
        .mockResolvedValueOnce(
          cast<AxiosResponse>({
            status: 200,
            headers: {},
            config: {},
            data: {
              items: [item('a', true), item('no-thumb', false)],
              nextPageToken: 'PAGE-2',
            },
          }),
        )
        .mockResolvedValueOnce(
          cast<AxiosResponse>({
            status: 200,
            headers: {},
            config: {},
            data: { items: [item('b', true)], nextPageToken: undefined },
          }),
        );

      const videos = await service.getAllVideosFromChannel('UU');

      expect(getSpy).toHaveBeenCalledTimes(2);
      expect(getSpy).toHaveBeenNthCalledWith(2, `${host}playlistItems`, {
        params: expect.objectContaining({ pageToken: 'PAGE-2' }),
      });
      expect(videos.map((video) => video.videoId)).toEqual(['a', 'b']);
    });

    it('translates API errors into HttpExceptions', async () => {
      const service = makeService();
      getSpy.mockRejectedValue(
        cast<never>({
          isAxiosError: true,
          response: { status: 500, data: {} },
        }),
      );

      try {
        await service.getAllVideosFromChannel('UU');
        throw new Error('expected an HttpException');
      } catch (error: unknown) {
        if (error instanceof HttpException) {
          expect(error.getStatus()).toBe(500);
        } else {
          throw error;
        }
      }
    });
  });

  describe('getAllVideosFromPlaylists', () => {
    it('deduplicates videos shared across playlists', async () => {
      const service = makeService();
      const item = (videoId: string): unknown => ({
        snippet: {
          title: `title-${videoId}`,
          description: 'desc',
          publishedAt: '2020-01-01',
          resourceId: { videoId },
          thumbnails: { high: { url: `https://thumb/${videoId}` } },
        },
      });
      getSpy
        .mockResolvedValueOnce(
          cast<AxiosResponse>({
            status: 200,
            headers: {},
            config: {},
            data: {
              items: [item('shared'), item('one')],
              nextPageToken: undefined,
            },
          }),
        )
        .mockResolvedValueOnce(
          cast<AxiosResponse>({
            status: 200,
            headers: {},
            config: {},
            data: {
              items: [item('shared'), item('two')],
              nextPageToken: undefined,
            },
          }),
        );

      const videos = await service.getAllVideosFromPlaylists(['PL1', 'PL2']);

      expect(videos.map((video) => video.videoId)).toEqual([
        'shared',
        'one',
        'two',
      ]);
    });
  });

  describe('isYoutubeShort', () => {
    const shortsUrl = 'https://www.youtube.com/shorts/abc';
    const watchUrl = 'https://www.youtube.com/watch?v=abc';

    it('returns true when the resolved URL is a Shorts page', async () => {
      const service = makeService();
      getSpy.mockResolvedValue(axGetResponse(shortsUrl, 200));

      await expect(service.isYoutubeShort('abc')).resolves.toBe(true);
    });

    it('returns false when the final URL is a regular watch page', async () => {
      const service = makeService();
      getSpy.mockResolvedValue(axGetResponse(watchUrl, 200));

      await expect(service.isYoutubeShort('abc')).resolves.toBe(false);
    });

    it('follows an explicit redirect then evaluates the final path', async () => {
      const service = makeService();
      getSpy
        .mockResolvedValueOnce(
          axGetResponse(shortsUrl, 300, { location: watchUrl }),
        )
        .mockResolvedValueOnce(axGetResponse(watchUrl, 200));

      await expect(service.isYoutubeShort('abc')).resolves.toBe(false);
      expect(getSpy).toHaveBeenCalledTimes(2);
    });

    it('returns false when the request fails', async () => {
      const service = makeService();
      getSpy.mockRejectedValue(new Error('network down'));

      await expect(service.isYoutubeShort('abc')).resolves.toBe(false);
    });
  });
});
