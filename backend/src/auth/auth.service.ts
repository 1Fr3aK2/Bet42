import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './login.dto';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email?.trim().toLowerCase();
    const identifier = email ?? dto.username;

    const key = `login_attempts:${identifier}`;
    const allowed = await this.rateLimiter.checkLimit(key, 5, 1800);
    if (!allowed) {
      throw new UnauthorizedException(
        'Too many failed attempts. Try again in 30 minutes.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: email ? { email } : { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.rateLimiter.resetLimit(key);

    const payload = {
      sub: user.id,
      username: user.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
  
  	async getMe(user: any) {
	const currentUser = await this.prisma.user.findUnique({
	  where: {
		id: user.id,
	  },
	  select: {
		id: true,
		username: true,
		email: true,
	  },
	});
  
	return currentUser;
  }
}