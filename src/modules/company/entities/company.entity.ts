import {
  Column,
  DataType,
  Model,
  Table,
  Unique,
  AllowNull,
  BelongsToMany,
} from 'sequelize-typescript';
import { Game } from '../../game/entities/game.entity';
import { GamesHasCompanies } from '../../../db/many-to-many/games-has-companies.table';

@Table({
  tableName: 'companies',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class Company extends Model {
  @Unique
  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    field: 'igdb_id',
  })
  igdbId!: number;

  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
  })
  name!: string;

  @BelongsToMany(() => Game, () => GamesHasCompanies)
  games!: Game[];
}
