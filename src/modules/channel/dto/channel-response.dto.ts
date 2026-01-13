import { Video } from '../../video/entities/video.entity';

export interface ParsingOptions {
  parsingAttribute?: string;
  ignoreEpisodesContaining?: string[];
  ignoreEpisodesMissing?: string[];
  ignoreSearchIn?: string[];
  endParsingAfter?: string[];
}

export interface ChannelResponseDto {
  id: number;
  name: string;
  youtubeHandle: string;
  youtubeId: string;
  youtubeUploadsId: string;
  description?: string;
  thumbnailUrl?: string;
  language: string;
  parsingOptions: ParsingOptions;
  videos?: Video[];
  videosCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
