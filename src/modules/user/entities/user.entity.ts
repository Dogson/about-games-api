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
  @Column({
    type: DataType.STRING(50),
  })
  username!: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
    field: 'password_hash',
  })
  passwordHash!: string;

  @AllowNull(false)
  @Default(1)
  @Column({
    type: DataType.BOOLEAN,
  })
  admin!: boolean;
}
