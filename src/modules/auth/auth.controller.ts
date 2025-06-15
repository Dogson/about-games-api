import {
  Controller,
  Get,
  Post,
  Body,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';
import Routes from '../../routes.config';

interface RequestWithUser extends Request {
  user: { userId: number; username: string }; // type your user here like in JwtStrategy.validate()
}

@Controller(Routes.AUTH)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(Routes.AUTH_LOGIN)
  async create(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return {
      access_token: this.authService.sign({
        sub: user.id,
        username: user.username,
      }),
      user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(Routes.AUTH_VALIDATE)
  validate(@Req() req: RequestWithUser) {
    return req.user;
  }
}
