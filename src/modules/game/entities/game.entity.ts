import {
  AllowNull,
  BelongsToMany,
  Column,
  DataType,
  Model,
  NotEmpty,
  Table,
} from 'sequelize-typescript';
import { Video } from '../../video/entities/video.entity';
import { VideosHasGames } from '../../../db/many-to-many/videos-has-games.table';
import { Company } from '../../company/entities/company.entity';
import { GamesHasCompanies } from '../../../db/many-to-many/games-has-companies.table';

@Table({ tableName: 'games', createdAt: 'created_at', updatedAt: 'updated_at' })
export class Game extends Model<Game> {
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

  @AllowNull(false)
  @Column({ type: DataType.DATE, field: 'release_date' })
  releaseDate!: Date;

  @BelongsToMany(() => Company, () => GamesHasCompanies)
  companies!: Company[];

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'cover_img' })
  coverImg?: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'boxart_img' })
  boxartImg?: string;

  @BelongsToMany(() => Video, () => VideosHasGames)
  videos!: Video[];
}
