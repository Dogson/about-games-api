import {
  AllowNull,
  BelongsToMany,
  Column,
  DataType,
  Default,
  Model,
  NotEmpty,
  Table,
} from 'sequelize-typescript';
import { Video } from '../../video/entities/video.entity';
import { VideosHasGames } from '../../../db/many-to-many/videos-has-games.table';
import { JsonArrayField } from '../../../decorators/json-array-string-field.decorator';

@Table({ tableName: 'games', createdAt: 'created_at', updatedAt: 'updated_at' })
export class Game extends Model {
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: 'igdb_id' })
  igdbId!: number;

  @AllowNull(false)
  @NotEmpty
  @Column(DataType.TEXT)
  title!: string;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: 'release_date' })
  releaseDate?: Date;

  @AllowNull(false)
  @JsonArrayField('companies')
  companies!: string[];

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'cover_img' })
  coverImg?: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'boxart_img' })
  boxartImg?: string;

  @AllowNull(true)
  @Default(0)
  @Column({
    type: DataType.BOOLEAN,
    field: 'ignore_during_search',
  })
  ignoreDuringSearch?: boolean;

  @BelongsToMany(() => Video, () => VideosHasGames)
  videos!: Video[];
}
