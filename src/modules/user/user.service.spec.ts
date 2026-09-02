import { UserService } from './user.service';
import { createModelMock } from 'src/testing/model-mock';
import { cast } from 'src/testing/cast';
import { User } from './entities/user.entity';

describe('UserService', () => {
  let userModel: ReturnType<typeof createModelMock>;
  let service: UserService;

  beforeEach(() => {
    userModel = createModelMock();
    service = new UserService(cast<typeof User>(userModel));
  });

  it('returns every user', async () => {
    userModel.findAll.mockResolvedValue([]);

    await service.findAll();

    expect(userModel.findAll).toHaveBeenCalled();
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
