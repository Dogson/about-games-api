import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { cast } from 'src/testing/cast';

type ValidatedUser = Awaited<ReturnType<AuthService['validateUser']>>;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      sign: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AuthController);
  });

  it('returns an access token and user on success', async () => {
    authService.validateUser.mockResolvedValue(
      cast<ValidatedUser>({ id: 1, username: 'alice', admin: true }),
    );
    authService.sign.mockReturnValue('token-1');

    await expect(
      controller.create({ username: 'alice', password: 'secret1' }),
    ).resolves.toEqual({
      access_token: 'token-1',
      user: { id: 1, username: 'alice', admin: true },
    });
    expect(authService.sign).toHaveBeenCalledWith({
      sub: 1,
      username: 'alice',
    });
  });

  it('throws an UnauthorizedException when credentials are invalid', async () => {
    authService.validateUser.mockResolvedValue(null);
    await expect(
      controller.create({ username: 'alice', password: 'wrong1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('echoes the authenticated user on validate', () => {
    const req = {
      user: { userId: 1, username: 'alice' },
    } as unknown as Parameters<AuthController['validate']>[0];

    expect(controller.validate(req)).toEqual({ userId: 1, username: 'alice' });
  });
});
