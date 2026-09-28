import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const USER_SORT_FIELDS = [
  'id',
  'username',
  'created_at',
  'updated_at',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type UserSortOrder = 'ASC' | 'DESC';

export class FindAllUsersDto {
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
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : undefined,
  )
  @IsIn(['ASC', 'DESC'])
  order?: UserSortOrder;
}
