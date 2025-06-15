import {
  Table,
  Model,
  Column,
  DataType,
  AllowNull,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
} from 'sequelize-typescript';
import { Channel } from '../../channel/entities/channel.entity';
import { Game } from '../../game/entities/game.entity';
import { VideosHasGames } from '../../../db/many-to-many/videos-has-games.table';

@Table({
  tableName: 'videos',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class Video extends Model {
  @ForeignKey(() => Channel)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: 'yt_channel_id' })
  ytChannelId!: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  title!: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT, field: 'youtube_id' })
  youtubeId!: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  description!: string;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: 'release_date' })
  releaseDate?: Date;

  @AllowNull(true)
  @Column(DataType.BOOLEAN)
  validated?: boolean;

  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: 'games_found_count' })
  gamesFoundCount?: number;

  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: 'games_count' })
  gamesCount?: number;

  @BelongsTo(() => Channel)
  ytChannel!: Channel;

  @BelongsToMany(() => Game, () => VideosHasGames)
  games!: Game[];
}
