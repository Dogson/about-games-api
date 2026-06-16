import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class CreateVideoDto {
  @IsInt()
  ytChannelId!: number;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  youtubeId!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsString()
  thumbnailUrl!: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsBoolean()
  validated?: boolean;

  @IsOptional()
  @IsBoolean()
  ignored?: boolean;

  @IsOptional()
  @IsBoolean()
  hasSearchedGames?: boolean;
}
