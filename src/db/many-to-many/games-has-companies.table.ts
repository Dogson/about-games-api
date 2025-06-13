import { Column, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Game } from '../../modules/game/entities/game.entity';
import { Company } from '../../modules/company/entities/company.entity';

@Table({
  tableName: 'games_has_companies',
  timestamps: false,
})
export class GamesHasCompanies extends Model {
  @ForeignKey(() => Game)
  @Column({ field: 'game_id' })
  gameId!: number;

  @ForeignKey(() => Company)
  @Column({ field: 'company_id' })
  companyId!: number;
}
