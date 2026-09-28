import { UserService } from './user.service';
import { createModelMock } from 'src/testing/model-mock';
import { cast } from 'src/testing/cast';
import { User } from './entities/user.entity';
import { Op } from 'sequelize';

describe('UserService', () => {
  let userModel: ReturnType<typeof createModelMock>;
  let service: UserService;

  beforeEach(() => {
    userModel = createModelMock();
    service = new UserService(cast<typeof User>(userModel));
  });

  it('returns a paginated list without password hashes', async () => {
    userModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const result = await service.findAll({
      page: 2,
      limit: 10,
      sortBy: 'username',
      order: 'DESC',
    });

    expect(userModel.findAndCountAll).toHaveBeenCalledWith({
      attributes: { exclude: ['passwordHash'] },
      where: undefined,
      order: [['username', 'DESC']],
      offset: 10,
      limit: 10,
    });
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    });
  });

  it('applies defaults when no query is provided', async () => {
    userModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    await service.findAll();

    expect(userModel.findAndCountAll).toHaveBeenCalledWith({
      attributes: { exclude: ['passwordHash'] },
      where: undefined,
      order: [['id', 'ASC']],
      offset: 0,
      limit: 20,
    });
  });

  it('filters by username when searching', async () => {
    userModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    await service.findAll({ search: '  ali  ' });

    expect(userModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { username: { [Op.like]: '%ali%' } },
      }),
    );
  });

  it('looks up a user by username', async () => {
    const found = cast<User>({ id: 1 });
    userModel.findOne.mockResolvedValue(found);

    await expect(service.findByUsername('alice')).resolves.toBe(found);
    expect(userModel.findOne).toHaveBeenCalledWith({
      where: { username: 'alice' },
    });
  });
});
