import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { cast } from 'src/testing/cast';

describe('JwtStrategy', () => {
  it('maps a validated jwt payload onto the request user', () => {
    const configService = cast<ConfigService>({
      get: (key: string): unknown =>
        key === 'SECRET_JWT_KEY' ? 'secret' : undefined,
    });
    const strategy = new JwtStrategy(configService);

    expect(strategy.validate({ sub: 5, username: 'alice' })).toEqual({
      userId: 5,
      username: 'alice',
    });
  });
});
