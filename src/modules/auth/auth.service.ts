import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import type { User } from '../user/entities/user.entity';

export interface JwtPayload {
  sub: number;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async validateUser(username: string, plainPassword: string) {
    // Fetch user from DB by username
    const user = await this.userService.findByUsername(username);

    if (!user) {
      return null;
    }

    // Compare plaintext password with hashed password
    const passwordMatches = await bcrypt.compare(
      plainPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return null;
    }

    // Exclude passwordHash from returned user object
    const authUser = user.get({ plain: true }) as User;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userInfo } = authUser;
    return userInfo;
  }

  sign(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }
}
