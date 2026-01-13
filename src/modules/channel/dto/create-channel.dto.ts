import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ParsingOptionsDto {
  @IsString()
  @IsNotEmpty()
  parsingAttribute!: string;

  @IsArray()
  ignoreEpisodesContaining!: string[];

  @IsArray()
  ignoreEpisodesMissing!: string[];

  @IsArray()
  ignoreSearchIn!: string[];

  @IsArray()
  endParsingAfter!: string[];
}

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  youtubeHandle!: string;

  @ValidateNested()
  @Type(() => ParsingOptionsDto)
  parsingOptions!: ParsingOptionsDto;

  @IsString()
  @IsNotEmpty()
  language!: string;
}
