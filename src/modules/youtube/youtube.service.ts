import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios, { type AxiosResponse } from 'axios';
import type {
  YouTubeApiErrorResponse,
  YouTubeChannel,
  YouTubeChannelsListResponse,
} from './dto/get-youtube-channel.dto';
import {
  type YouTubePlaylistItemsListResponse,
  YouTubeVideoItem,
} from './dto/get-youtube-video.dto';

@Injectable()
export class YoutubeService {
  private readonly apiKey = process.env.YOUTUBE_API_KEY;
  private readonly apiHost = process.env.YOUTUBE_API_HOST;
  private readonly logger = new Logger(YoutubeService.name);

  async getYtChannelInfosById(channelId: string): Promise<YouTubeChannel> {
    return this._getYtChannelInfosByIdOrHandle({
      kind: 'id',
      youtubeId: channelId,
    });
  }

  async getYtChannelInfosByHandle(
    channelHandle: string,
  ): Promise<YouTubeChannel> {
    return this._getYtChannelInfosByIdOrHandle({
      kind: 'handle',
      youtubeHandle: channelHandle,
    });
  }

  private async _getYtChannelInfosByIdOrHandle(
    params:
      | {
          kind: 'id';
          youtubeId: string;
        }
      | {
          kind: 'handle';
          youtubeHandle: string;
        },
  ): Promise<YouTubeChannel> {
    if (!this.apiKey || !this.apiHost) {
      throw new HttpException(
        'YouTube API key or host not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const url = `${this.apiHost}channels`;

    try {
      const apiReqParams: {
        key: string;
        part: string;
        forHandle?: string;
        id?: string;
      } = {
        key: this.apiKey,
        part: 'snippet,statistics,contentDetails',
      };
      if (params.kind === 'id') {
        apiReqParams.id = params.youtubeId;
      } else {
        const cleanHandle = params.youtubeHandle.startsWith('@')
          ? params.youtubeHandle.slice(1)
          : params.youtubeHandle;

        apiReqParams.forHandle = cleanHandle;
      }

      const response = await axios.get<YouTubeChannelsListResponse>(url, {
        params: apiReqParams,
      });

      if (response.data.items.length === 0) {
        throw new HttpException('Channel not found', HttpStatus.NOT_FOUND);
      }
      return response.data.items[0];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const data = error.response?.data as
          | YouTubeApiErrorResponse
          | undefined;

        throw new HttpException(
          data?.error?.message || 'YouTube API error',
          error.response?.status || HttpStatus.BAD_GATEWAY,
        );
      }
      throw new HttpException(
        'Failed to fetch channel info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllVideosFromChannel(
    uploadsId: string,
  ): Promise<YouTubeVideoItem[]> {
    if (!this.apiKey || !this.apiHost) {
      throw new HttpException(
        'YouTube API key or host not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const url = `${this.apiHost}playlistItems`;

    const videos: YouTubeVideoItem[] = [];
    let nextPageToken: string | undefined = undefined;

    try {
      do {
        const params: {
          part: string;
          playlistId: string;
          maxResults: number;
          pageToken?: string;
          key: string;
        } = {
          part: 'snippet',
          playlistId: uploadsId,
          maxResults: 50,
          pageToken: nextPageToken,
          key: this.apiKey,
        };

        const response = await axios.get<YouTubePlaylistItemsListResponse>(
          url,
          {
            params,
          },
        );

        for (const item of response.data.items) {
          const { snippet } = item;
          if (snippet.thumbnails?.high?.url)
            videos.push({
              title: snippet.title,
              videoId: snippet.resourceId.videoId,
              publishedAt: snippet.publishedAt,
              description: snippet.description,
              thumbnailUrl: snippet.thumbnails.high.url,
            });
        }

        nextPageToken = response.data.nextPageToken;
      } while (nextPageToken);

      return videos;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const data = error.response.data as
          | { error?: { message?: string } }
          | undefined;

        throw new HttpException(
          data?.error?.message || 'YouTube API error',
          error.response.status || HttpStatus.BAD_GATEWAY,
        );
      }

      throw new HttpException(
        'Failed to fetch videos from channel',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async isYoutubeShort(videoId: string): Promise<boolean> {
    const url = `https://www.youtube.com/shorts/${videoId}`;

    try {
      let currentUrl: string | undefined = url;
      for (let i = 0; i < 5 && currentUrl; i++) {
        const response: AxiosResponse = await axios.get(currentUrl, {
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          },
        });

        if (response.status < 300) {
          const finalPath = new URL(response.config.url ?? currentUrl).pathname;
          return finalPath.startsWith('/shorts/');
        }

        const location = response.headers.location as string | undefined;
        if (!location) {
          return false;
        }
        currentUrl = new URL(location, currentUrl).toString();
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check if video ${videoId} is a Short: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
