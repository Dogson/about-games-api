import { PartialType } from '@nestjs/mapped-types';
import { CreateVideoDto } from './create-video.dto';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsOptional } from 'class-validator';
import { CreateGameDto } from '../../game/dto/create-game.dto';

export class UpdateVideoDto extends PartialType(CreateVideoDto) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGameDto)
  games?: CreateGameDto[];
}
