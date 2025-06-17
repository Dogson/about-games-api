import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  youtubeHandle!: string;

  @IsString()
  @IsNotEmpty()
  parsingAttribute!: string;

  @IsString()
  @IsNotEmpty()
  language!: string;

  @IsArray()
  ignoreEpisodesContaining!: string[];

  @IsArray()
  ignoreEpisodesMissing!: string[];

  @IsArray()
  ignoreSearchIn!: string[];

  @IsArray()
  endParsingAfter!: string[];
}
