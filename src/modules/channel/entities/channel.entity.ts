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

  @Unique('name')
  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare name: string;

  @Unique('youtube_handle')
  @AllowNull(false)
  @Column({ type: DataType.STRING(255), field: 'youtube_handle' })
  declare youtubeHandle: string;

  @Unique('youtube_id')
  @AllowNull(false)
  @Column({ type: DataType.STRING(255), field: 'youtube_id' })
  declare youtubeId: string;

  @Unique('youtube_uploads_id')
  @AllowNull(false)
  @Column({ type: DataType.STRING(255), field: 'youtube_uploads_id' })
  declare youtubeUploadsId: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description?: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'thumbnail_url' })
  declare thumbnailUrl?: string;

  @AllowNull(false)
  @Column(DataType.STRING(45))
  declare language: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING(255),
    field: 'parsing_attribute',
  })
  declare parsingAttribute: string;

  @AllowNull(true)
  @JsonArrayField('ignore_episodes_containing')
  declare ignoreEpisodesContaining: string[];

  @AllowNull(true)
  @JsonArrayField('ignore_episodes_missing')
  declare ignoreEpisodesMissing: string[];

  @AllowNull(true)
  @JsonArrayField('ignore_search_in')
  declare ignoreSearchIn: string[];

  @AllowNull(true)
  @JsonArrayField('end_parsing_after')
  declare endParsingAfter: string[];

  @HasMany(() => Video)
  videos!: Video[];
}
