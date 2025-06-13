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

@Table({
  tableName: 'yt_channel',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class Channel extends Model {
  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(255))
  name: string;

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(255), field: 'youtube_id' })
  youtubeId: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description?: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  thumbnail?: string;

  @AllowNull(false)
  @Column(DataType.STRING(45))
  language: string;

  @HasMany(() => Video)
  videos: Video[];
}
