import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { cast } from 'src/testing/cast';

describe('AuthService', () => {
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let userService: jest.Mocked<Pick<UserService, 'findByUsername'>>;
  let service: AuthService;
  let compareSpy: jest.SpyInstance;

  const userInstance = cast<User>({
    id: 1,
    username: 'alice',
    passwordHash: 'hashed',
    admin: true,
    get: (options: unknown) => {
      if (options === 'id' || options === 'username') {
        return options === 'id' ? 1 : 'alice';
      }
      return {
        id: 1,
        username: 'alice',
        passwordHash: 'hashed',
        admin: true,
      };
    },
  });

  beforeEach(() => {
    jwtService = {
      sign: jest.fn(),
    } as unknown as jest.Mocked<Pick<JwtService, 'sign'>>;
    userService = {
      findByUsername: jest.fn(),
    } as unknown as jest.Mocked<Pick<UserService, 'findByUsername'>>;
    service = new AuthService(
      cast<JwtService>(jwtService),
      cast<UserService>(userService),
    );
    compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateUser', () => {
    it('returns null when the user does not exist', async () => {
      userService.findByUsername.mockResolvedValue(null);

      await expect(service.validateUser('alice', 'pw')).resolves.toBeNull();
      expect(compareSpy).not.toHaveBeenCalled();
    });

    it('returns null when the password does not match', async () => {
      userService.findByUsername.mockResolvedValue(userInstance);
      compareSpy.mockResolvedValue(false as never);

      await expect(service.validateUser('alice', 'wrong')).resolves.toBeNull();
      expect(compareSpy).toHaveBeenCalledWith('wrong', 'hashed');
    });

    it('returns the user without the password hash on success', async () => {
      userService.findByUsername.mockResolvedValue(userInstance);
      compareSpy.mockResolvedValue(true as never);

      const result = await service.validateUser('alice', 'correct');

      expect(result).toEqual({
        id: 1,
        username: 'alice',
        admin: true,
      });
      expect(Object.keys(result as Record<string, unknown>)).not.toContain(
        'passwordHash',
      );
    });
  });

  describe('sign', () => {
    it('delegates the payload to the jwt service', () => {
      jwtService.sign.mockReturnValue('signed-token');

      expect(service.sign({ sub: 1, username: 'alice' })).toBe('signed-token');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        username: 'alice',
      });
    });
  });
});
