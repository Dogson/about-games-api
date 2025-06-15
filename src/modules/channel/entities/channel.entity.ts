import {
  Table,
  Model,
  Column,
  DataType,
  Unique,
  AllowNull,
  HasMany,
} from 'sequelize-typescript';
import { Video } from '../../video/entities/video.entity';
import { JsonArrayField } from '../../../decorators/json-array-string-field.decorator';

@Table({
  tableName: 'yt_channel',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class Channel extends Model {
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(255))
  name!: string;

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(255), field: 'youtube_id' })
  youtubeId!: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description?: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  thumbnail?: string;

  @AllowNull(false)
  @Column(DataType.STRING(45))
  language!: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING(255),
    field: 'parsing_attribute',
  })
  parsingAttribute!: string;

  @AllowNull(true)
  @JsonArrayField('ignore_episodes_containing')
  ignoreEpisodesContaining!: string[];

  @AllowNull(true)
  @JsonArrayField('ignore_search_in')
  ignoreSearchIn!: string[];

  @AllowNull(true)
  @JsonArrayField('end_parsing_after')
  endParsingAfter!: string[];

  @HasMany(() => Video)
  videos!: Video[];
}
