import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // prend le token dans Authorization: Bearer ...
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SECRET_JWT_KEY') as string,
    });
  }

  validate(payload: { sub: number; username: string }) {
    // Ce que tu renvoies ici sera disponible dans req.user
    return { userId: payload.sub, username: payload.username };
  }
}
