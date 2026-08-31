import {
  IsNotEmpty,
  IsInt,
  IsArray,
  IsOptional,
  IsString,
  IsDate,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGameDto {
  @IsInt()
  igdbId!: number;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @Transform(({ value }) => new Date(value as string))
  @IsDate()
  releaseDate!: Date | null; // Use ISO date string for DTO

  @IsArray()
  @IsString({ each: true })
  companies!: string[];

  @IsOptional()
  @IsString()
  coverImg!: string | null;

  @IsOptional()
  @IsString()
  boxartImg!: string | null;
}
