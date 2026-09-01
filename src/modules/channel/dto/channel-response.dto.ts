import { Video } from '../../video/entities/video.entity';

export interface ParsingOptions {
  ignoreEpisodesContaining?: string[];
  playlistsIds?: string[];
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
  gameCandidateAIPrompt?: string;
  videos?: Video[];
  videosCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
