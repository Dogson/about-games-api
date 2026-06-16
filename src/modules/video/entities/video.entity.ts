import {
  Table,
  Model,
  Column,
  DataType,
  AllowNull,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  Unique,
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
  declare ytChannelId: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare title: string;

  @Unique('youtube_id')
  @AllowNull(false)
  @Column({ type: DataType.STRING(255), field: 'youtube_id' })
  declare youtubeId: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: 'release_date' })
  declare releaseDate?: Date;

  @AllowNull(false)
  @Column({ type: DataType.TEXT, field: 'thumbnail_url' })
  declare thumbnailUrl: string;

  @AllowNull(true)
  @Column(DataType.BOOLEAN)
  declare validated?: boolean;

  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare ignored: boolean;

  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: 'games_found_count' })
  declare gamesFoundCount?: number;

  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: 'games_count' })
  declare gamesCount?: number;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'has_searched_games',
    defaultValue: false,
  })
  declare hasSearchedGames: boolean;

  @BelongsTo(() => Channel)
  ytChannel!: Channel;

  @BelongsToMany(() => Game, () => VideosHasGames)
  games!: Game[];
}
