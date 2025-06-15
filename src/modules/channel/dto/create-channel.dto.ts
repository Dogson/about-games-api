import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  youtubeId!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  thumbnail!: string;

  @IsString()
  @IsNotEmpty()
  language!: string;

  @IsString()
  @IsNotEmpty()
  parsingAttribute!: string;

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
