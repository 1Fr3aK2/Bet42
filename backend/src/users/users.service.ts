import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcrypt';
import { BetStatus, Prisma, Role, TransactionType } from '@prisma/client';
import { UpdateMeDto } from './update-me.dto';
import { UpdatePasswordDto } from './update-password.dto';
import { AdminUpdateUserDto } from './admin-update-user.dto';
import { ListUsersDto } from './list-users.dto';
import { AvailabilityDto } from './availability.dto';
import { STARTING_BALANCE } from '../bets/bets.constants';
import { levelForXp } from '../gamification/gamification.constants';
import { avatarUrl } from '../gamification/gamification.service';

// Fields returned for an account (never the password hash).
const ACCOUNT_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  avatar: true,
  wallet: true,
  wins: true,
  losses: true,
  xp: true,
  currentStreak: true,
  bestStreak: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

// Same without the avatar image itself (lists use avatarUrl instead).
const { avatar: _avatar, ...LIST_SELECT } = ACCOUNT_SELECT;

const PALETTE = ['#e8a020', '#2ea84b', '#3b82f6', '#a855f7', '#e05252', '#14b8a6'];

function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly events: EventEmitter2,
  ) {}

  private withComputed<T extends { id: number; updatedAt: Date; xp: number }>(user: T) {
    return { ...user, level: levelForXp(user.xp), avatarUrl: avatarUrl(user) };
  }

  // Usernames are unique ignoring case ("Admin" cannot copy "admin").
  private async assertUsernameFree(username: string | undefined, exceptUserId?: number) {
    if (!username) return;

    const taken = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        ...(exceptUserId && { id: { not: exceptUserId } }),
      },
      select: { id: true },
    });

    if (taken) {
      throw new ConflictException('This username is already taken');
    }
  }

  // Lets the registration form check its fields before submitting.
  async availability(dto: AvailabilityDto) {
    const username = dto.username?.trim();
    const email = dto.email?.trim().toLowerCase();

    const [userWithName, userWithEmail] = await Promise.all([
      username
        ? this.prisma.user.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } },
            select: { id: true },
          })
        : null,
      email
        ? this.prisma.user.findUnique({ where: { email }, select: { id: true } })
        : null,
    ]);

    return {
      username: username ? !userWithName : null,
      email: email ? !userWithEmail : null,
    };
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Username or email already exists');
    }

    throw error;
  }

  async findAll(query: ListUsersDto = {}) {
    const search = query.search?.trim();

    const users = await this.prisma.user.findMany({
      where: {
        role: query.role,
        ...(search && {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { id: 'asc' },
      select: LIST_SELECT,
    });

    return users.map((user) => this.withComputed(user));
  }

  async create(createUserDto: CreateUserDto) {
    await this.assertUsernameFree(createUserDto.username);
    const hash = await bcrypt.hash(createUserDto.password, 10);

    try {
      // The account and its first ledger entry are created together.
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            username: createUserDto.username,
            email: createUserDto.email,
            password: hash,
            wallet: STARTING_BALANCE,
          },
          select: ACCOUNT_SELECT,
        });

        await this.wallet.record(
          tx,
          created.id,
          TransactionType.SIGNUP_BONUS,
          STARTING_BALANCE,
          STARTING_BALANCE,
        );

        return created;
      });

      return this.withComputed(user);
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async updateRole(
    userId: number,
    role: Role,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with id ${userId} not found`,
      );
    }

    if (user.role === Role.ADMIN) {
      throw new BadRequestException(
        'Admin role cannot be changed through this endpoint',
      );
    }

    if (role !== Role.USER && role !== Role.MODERATOR) {
      throw new BadRequestException(
        'Role must be USER or MODERATOR',
      );
    }

    const updated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });

    // The user's open tabs reload their profile, so menus change right away.
    this.events.emit('user.updated', { userId });

    return updated;
  }

  async findMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: ACCOUNT_SELECT,
    });

    if (!user) {
      throw new NotFoundException(
        `User with id ${userId} not found`,
      );
    }

    return this.withComputed(user);
  }

  // Admin view of one account, with a summary of its activity.
  async findOne(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...LIST_SELECT,
        _count: { select: { bets: true, posts: true, comments: true, achievements: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const recentBets = await this.prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return { ...this.withComputed(user), recentBets };
  }

  // Public profile: what any visitor can see (no email, no settings).
  async getPublicProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        wallet: true,
        wins: true,
        losses: true,
        xp: true,
        bestStreak: true,
        createdAt: true,
        updatedAt: true,
        achievements: {
          select: { unlockedAt: true, achievement: true },
          orderBy: { unlockedAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const recentBets = await this.prisma.bet.findMany({
      where: { userId, status: { not: BetStatus.PENDING } },
      orderBy: { resolvedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        coin: true,
        direction: true,
        amount: true,
        duration: true,
        status: true,
        payout: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const played = user.wins + user.losses;

    return {
      ...this.withComputed(user),
      winRate: played ? user.wins / played : 0,
      achievements: user.achievements.map((a) => ({
        ...a.achievement,
        unlockedAt: a.unlockedAt,
      })),
      recentBets,
    };
  }

  async updateMe(userId: number, updateMeDto: UpdateMeDto) {
    await this.assertUsernameFree(updateMeDto.username, userId);

    try {
      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          username: updateMeDto.username,
          avatar: updateMeDto.avatar,
        },
        select: ACCOUNT_SELECT,
      });

      return this.withComputed(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with id ${userId} not found`);
      }

      this.handleUniqueError(error);
    }
  }

  // Admin edit of another account (username, email, balance).
  async adminUpdate(actorId: number, userId: number, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!target) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (target.role === Role.ADMIN && target.id !== actorId) {
      throw new ForbiddenException('Other administrators cannot be edited');
    }

    await this.assertUsernameFree(dto.username, userId);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        if (dto.wallet !== undefined) {
          await this.wallet.set(tx, userId, dto.wallet);
        }

        return tx.user.update({
          where: { id: userId },
          data: { username: dto.username, email: dto.email },
          select: LIST_SELECT,
        });
      });

      if (dto.wallet !== undefined) {
        this.events.emit('wallet.changed', { userId, wallet: user.wallet });
      }
      this.events.emit('user.updated', { userId });

      return this.withComputed(user);
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async adminDelete(actorId: number, userId: number) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!target) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (target.id === actorId) {
      throw new BadRequestException(
        'Use the account settings to delete your own account',
      );
    }

    if (target.role === Role.ADMIN) {
      throw new ForbiddenException('Administrators cannot be deleted');
    }

    await this.deleteAccount(userId);

    return { message: `User ${target.username} deleted` };
  }

  // Self-service deletion (GDPR "right to erasure"). Needs the password.
  async deleteMe(userId: number, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (user.role === Role.ADMIN) {
      throw new ForbiddenException(
        'The administrator account cannot be deleted from the website',
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new BadRequestException('Password is incorrect');
    }

    await this.deleteAccount(userId);

    return { message: 'Your account and its data have been deleted' };
  }

  // Bets, ledger, achievements, posts, comments and reports are removed by
  // the ON DELETE CASCADE foreign keys. Reports that point at this user's
  // posts/comments are not foreign keys, so they are deleted here.
  private async deleteAccount(userId: number) {
    await this.prisma.$transaction(async (tx) => {
      const [posts, comments] = await Promise.all([
        tx.post.findMany({ where: { authorId: userId }, select: { id: true } }),
        tx.comment.findMany({ where: { authorId: userId }, select: { id: true } }),
      ]);

      await tx.report.deleteMany({
        where: {
          OR: [
            { targetType: 'post', targetId: { in: posts.map((p) => p.id) } },
            { targetType: 'comment', targetId: { in: comments.map((c) => c.id) } },
          ],
        },
      });

      await tx.user.delete({ where: { id: userId } });
    });

    this.events.emit('user.deleted', { userId });
  }

  // Uploaded avatar, or a generated default one (initial on a coloured circle).
  async getAvatar(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, avatar: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const match = user.avatar?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match) {
      return { contentType: match[1], body: Buffer.from(match[2], 'base64') };
    }

    const initial = escapeXml(user.username.charAt(0).toUpperCase());
    const color = PALETTE[userId % PALETTE.length];
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="64" fill="${color}"/>` +
      `<text x="64" y="64" dy="0.35em" text-anchor="middle" font-family="Courier New, monospace" ` +
      `font-size="64" font-weight="700" fill="#0d0f14">${initial}</text></svg>`;

    return { contentType: 'image/svg+xml', body: Buffer.from(svg) };
  }

  async updatePassword(
    userId: number,
    updatePasswordDto: UpdatePasswordDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with id ${userId} not found`,
      );
    }

    const passwordValid = await bcrypt.compare(
      updatePasswordDto.currentPassword,
      user.password,
    );

    if (!passwordValid) {
      throw new BadRequestException(
        'Current password is incorrect',
      );
    }

    const hash = await bcrypt.hash(
      updatePasswordDto.newPassword,
      10,
    );

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hash,
      },
    });

    return {
      message: 'Password updated successfully',
    };
  }
}
