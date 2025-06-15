import { JwtPayload } from '../auth/auth.service'; // or wherever your JWT payload is defined

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}
