import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../realtime/presence.service';
import { levelForXp } from '../gamification/gamification.constants';
import { avatarUrl } from '../gamification/gamification.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';

const PUBLIC_USER = {
  id: true,
  username: true,
  xp: true,
  updatedAt: true,
} as const;

// Friend requests and friends list. A Friendship row goes from the sender
// to the receiver; ACCEPTED means both are friends. Every change is pushed
// to both users through the 'friends.changed' event.
@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly events: EventEmitter2,
  ) {}

  private toPublic(user: { id: number; username: string; xp: number; updatedAt: Date }) {
    return {
      id: user.id,
      username: user.username,
      level: levelForXp(user.xp),
      avatarUrl: avatarUrl(user),
      online: this.presence.isOnline(user.id),
    };
  }

  private changed(...userIds: number[]) {
    this.events.emit('friends.changed', { userIds });
  }

  // Friendship rows between two users, in either direction.
  private between(a: number, b: number) {
    return this.prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: a, receiverId: b },
          { senderId: b, receiverId: a },
        ],
      },
    });
  }

  async list(userId: number) {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        sender: { select: PUBLIC_USER },
        receiver: { select: PUBLIC_USER },
      },
    });

    const friends = [];
    const incoming = [];
    const outgoing = [];

    for (const row of rows) {
      const other = row.senderId === userId ? row.receiver : row.sender;
      const entry = { requestId: row.id, since: row.updatedAt, user: this.toPublic(other) };

      if (row.status === FriendshipStatus.ACCEPTED) friends.push(entry);
      else if (row.receiverId === userId) incoming.push(entry);
      else outgoing.push(entry);
    }

    // Online friends first, then alphabetical.
    friends.sort(
      (a, b) =>
        Number(b.user.online) - Number(a.user.online) ||
        a.user.username.localeCompare(b.user.username),
    );

    return { friends, incoming, outgoing };
  }

  async sendRequest(userId: number, dto: SendFriendRequestDto) {
    const target = await this.prisma.user.findFirst({
      where: dto.userId !== undefined
        ? { id: dto.userId }
        : { username: { equals: dto.username.trim(), mode: 'insensitive' } },
      select: { id: true, username: true },
    });

    if (!target) {
      throw new NotFoundException('No player with this username');
    }

    if (target.id === userId) {
      throw new BadRequestException('You cannot add yourself as a friend');
    }

    const existing = await this.between(userId, target.id);

    if (existing.some((f) => f.status === FriendshipStatus.ACCEPTED)) {
      throw new ConflictException(`You are already friends with ${target.username}`);
    }

    if (existing.some((f) => f.senderId === userId)) {
      throw new ConflictException(`A request to ${target.username} is already pending`);
    }

    // They already asked us: sending a request back accepts theirs.
    const reverse = existing.find((f) => f.senderId === target.id);
    if (reverse) {
      return this.accept(userId, reverse.id);
    }

    try {
      const request = await this.prisma.friendship.create({
        data: { senderId: userId, receiverId: target.id },
      });
      this.changed(userId, target.id);
      return { status: 'requested', requestId: request.id, username: target.username };
    } catch {
      // Unique (senderId, receiverId): a parallel identical request won.
      throw new ConflictException(`A request to ${target.username} is already pending`);
    }
  }

  async accept(userId: number, requestId: number) {
    const request = await this.prisma.friendship.findUnique({ where: { id: requestId } });

    if (!request || request.status !== FriendshipStatus.PENDING) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.receiverId !== userId) {
      throw new ForbiddenException('Only the receiver can accept this request');
    }

    await this.prisma.$transaction([
      this.prisma.friendship.update({
        where: { id: requestId },
        data: { status: FriendshipStatus.ACCEPTED },
      }),
      // If both sent a request at the same time, keep a single row.
      this.prisma.friendship.deleteMany({
        where: { senderId: userId, receiverId: request.senderId },
      }),
    ]);

    this.changed(userId, request.senderId);

    return { status: 'friends', requestId };
  }

  // Receiver declines, or sender cancels, a pending request.
  async deleteRequest(userId: number, requestId: number) {
    const request = await this.prisma.friendship.findUnique({ where: { id: requestId } });

    if (!request || request.status !== FriendshipStatus.PENDING) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.senderId !== userId && request.receiverId !== userId) {
      throw new ForbiddenException('This request is not yours');
    }

    await this.prisma.friendship.delete({ where: { id: requestId } });
    this.changed(request.senderId, request.receiverId);

    return { status: 'deleted' };
  }

  async removeFriend(userId: number, friendId: number) {
    const deleted = await this.prisma.friendship.deleteMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('This player is not in your friends list');
    }

    this.changed(userId, friendId);

    return { status: 'removed' };
  }

  // Relationship with another player, for the button on their profile.
  async relationship(userId: number, otherId: number) {
    if (userId === otherId) {
      return { status: 'self' };
    }

    const rows = await this.between(userId, otherId);
    const accepted = rows.find((f) => f.status === FriendshipStatus.ACCEPTED);

    if (accepted) {
      return { status: 'friends', requestId: accepted.id, online: this.presence.isOnline(otherId) };
    }

    const outgoing = rows.find((f) => f.senderId === userId);
    if (outgoing) return { status: 'outgoing', requestId: outgoing.id };

    const incoming = rows.find((f) => f.receiverId === userId);
    if (incoming) return { status: 'incoming', requestId: incoming.id };

    return { status: 'none' };
  }
}
