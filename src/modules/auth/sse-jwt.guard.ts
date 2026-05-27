import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class SseJwtGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const req: Request = context.switchToHttp().getRequest();

    const authHeader = req.headers.authorization;

    const bearerToken =
      typeof authHeader === 'string'
        ? authHeader.replace('Bearer ', '')
        : undefined;

    const queryToken =
      typeof req.query.token === 'string' ? req.query.token : undefined;

    const token = bearerToken || queryToken;

    req.headers.authorization = token ? `Bearer ${token}` : undefined;

    return req;
  }
}
