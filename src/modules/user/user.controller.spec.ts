import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    userService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(UserController);
  });

  it('delegates findAll and findOne with a numeric id', async () => {
    await controller.findAll();
    expect(userService.findAll).toHaveBeenCalled();

    await controller.findOne('5');
    expect(userService.findOne).toHaveBeenCalledWith(5);
  });

  it('delegates create, update and remove', async () => {
    await controller.create({});
    expect(userService.create).toHaveBeenCalledWith({});

    await controller.update('5', {});
    expect(userService.update).toHaveBeenCalledWith(5, {});

    await controller.remove('5');
    expect(userService.remove).toHaveBeenCalledWith(5);
  });
});
