import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class ParsingOptionsDto {
  @IsArray()
  ignoreEpisodesContaining!: string[];

  @IsArray()
  ignoreEpisodesMissing!: string[];
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

  @IsOptional()
  @IsString()
  gameCandidateAIPrompt?: string;
}
