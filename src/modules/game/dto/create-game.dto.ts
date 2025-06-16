import {
  IsNotEmpty,
  IsInt,
  IsDateString,
  IsArray,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  IsBoolean,
} from 'class-validator';

export class CreateGameDto {
  @IsInt()
  igdbId!: number;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsDateString()
  releaseDate!: string; // Use ISO date string for DTO

  @IsBoolean()
  ignoreDuringSearch?: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  companies!: string[];

  @IsOptional()
  @IsString()
  coverImg?: string;

  @IsOptional()
  @IsString()
  boxartImg?: string;
}
