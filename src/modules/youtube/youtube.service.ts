import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import type {
  YouTubeApiErrorResponse,
  YouTubeChannel,
  YouTubeChannelsListResponse,
} from './dto/get-youtube-channel.dto';

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
      part: 'snippet,statistics',
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
}
