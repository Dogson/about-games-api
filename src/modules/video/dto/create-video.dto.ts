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
  description!: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsBoolean()
  validated?: boolean;

  @IsOptional()
  @IsInt()
  gamesFoundCount?: number;

  @IsOptional()
  @IsInt()
  gamesCount?: number;
}
