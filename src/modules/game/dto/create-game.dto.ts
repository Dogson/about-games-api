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

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? null
      : new Date(value as string),
  )
  @IsOptional()
  @IsDate()
  releaseDate!: Date | null; // ISO date string or null when the date is unknown

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
