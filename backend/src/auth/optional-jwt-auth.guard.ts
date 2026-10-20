import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Like JwtAuthGuard, but lets guests through: request.user is the logged-in
// user when a valid token is sent, and null otherwise.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_error: unknown, user: any) {
    return user || null;
  }
}
