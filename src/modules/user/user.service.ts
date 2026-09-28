import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './entities/user.entity';
import { FindAllUsersDto } from './dto/find-all-users.dto';
import ApiConfig from '../../api.config';
import { Op, Order, WhereOptions } from 'sequelize';

export interface UserListEnvelope {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  create(createUserDto: CreateUserDto) {
    console.info(createUserDto);
    return 'This action adds a new user';
  }

  async findAll(findAllUsersDto?: FindAllUsersDto): Promise<UserListEnvelope> {
    const page = findAllUsersDto?.page ?? 1;
    const limit = findAllUsersDto?.limit ?? ApiConfig.USERS_LIMIT_DEFAULT;
    const offset = (page - 1) * limit;
    const sortBy = findAllUsersDto?.sortBy ?? 'id';
    const order = findAllUsersDto?.order ?? 'ASC';
    const search = findAllUsersDto?.search?.trim();

    const where: WhereOptions<User> | undefined =
      search && search.length > 0
        ? { username: { [Op.like]: `%${search}%` } }
        : undefined;

    const orderClause: Order = [[sortBy, order]];

    const result = await this.userModel.findAndCountAll({
      attributes: { exclude: ['passwordHash'] },
      where,
      order: orderClause,
      offset,
      limit,
    });

    return {
      data: result.rows,
      total: result.count,
      page,
      limit,
      totalPages: Math.ceil(result.count / limit),
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  findByUsername(username: string) {
    return this.userModel.findOne({ where: { username } });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    console.info(updateUserDto);
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
