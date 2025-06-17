import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
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

  async getYtChannelInfosByHandle(
    channelHandle: string,
  ): Promise<YouTubeChannel> {
    if (!this.apiKey || !this.apiHost) {
      throw new HttpException(
        'YouTube API key or host not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const url = `${this.apiHost}channels`;

    const cleanHandle = channelHandle.startsWith('@')
      ? channelHandle.slice(1)
      : channelHandle;

    const params = {
      part: 'snippet,statistics,contentDetails',
      forHandle: cleanHandle,
      key: this.apiKey,
    };

    try {
      const response = await axios.get<YouTubeChannelsListResponse>(url, {
        params,
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
}
