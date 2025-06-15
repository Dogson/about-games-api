import {
  Table,
  Column,
  Model,
  DataType,
  AllowNull,
  Default,
} from 'sequelize-typescript';

@Table({
  tableName: 'users',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class User extends Model {
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(50),
  })
  declare username: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
    field: 'password_hash',
  })
  declare passwordHash: string;

  @AllowNull(false)
  @Default(1)
  @Column({
    type: DataType.BOOLEAN,
  })
  declare admin: boolean;
}
