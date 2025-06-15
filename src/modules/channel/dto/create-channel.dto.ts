import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty } from 'class-validator';

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
  @ArrayNotEmpty()
  ignoreEpisodesContaining!: string[];

  @IsArray()
  @ArrayNotEmpty()
  ignoreSearchIn!: string[];

  @IsArray()
  @ArrayNotEmpty()
  endParsingAfter!: string[];
}
