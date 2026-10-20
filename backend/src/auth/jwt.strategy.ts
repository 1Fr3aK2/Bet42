import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(private readonly prisma: PrismaService) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: process.env.JWT_SECRET,
  });
}

	// A token stays valid for a day, so check the account still exists:
	// a deleted user's token is rejected with 401.
	async validate(payload: any) {
	const user = await this.prisma.user.findUnique({
	  where: { id: payload.sub },
	  select: { id: true, username: true, email: true, role: true },
	});

	return user ?? null;
  }
}
