import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FindAllGamesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  igdbId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  })
  @IsBoolean()
  ignoreDuringSearch?: boolean;
}
