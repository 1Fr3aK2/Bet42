import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import {
  ACHIEVEMENTS,
  AchievementDefinition,
  DAILY_BONUS_AMOUNT,
  DAILY_BONUS_XP,
  levelForXp,
  levelProgress,
} from './gamification.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GamificationOutcome {
  xp: number;
  level: number;
  levelUp: boolean;
  unlocked: AchievementDefinition[];
}

export type LeaderboardSort = 'balance' | 'xp' | 'wins';

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function avatarUrl(user: { id: number; updatedAt: Date }) {
  return `/users/${user.id}/avatar?v=${user.updatedAt.getTime()}`;
}

@Injectable()
export class GamificationService implements OnModuleInit {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly events: EventEmitter2,
  ) {}

  // Copies the achievement catalog (gamification.constants.ts) into the database.
  async onModuleInit() {
    for (const { code, ...fields } of ACHIEVEMENTS) {
      await this.prisma.achievement.upsert({
        where: { code },
        create: { code, ...fields },
        update: fields,
      });
    }

    this.logger.log(`Achievement catalog synced (${ACHIEVEMENTS.length})`);
  }

  // Called inside the transaction that changed the user's stats (bet placed,
  // bet settled, daily bonus). Unlocks the candidate achievements plus the
  // level/balance ones, adds their XP and reports whether the user levelled up.
  async evaluate(
    tx: Prisma.TransactionClient,
    userId: number,
    xpBefore: number,
    candidateCodes: string[],
  ): Promise<GamificationOutcome> {
    const unlocked = await this.unlock(tx, userId, candidateCodes);

    let user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, wallet: true },
    });

    const followUps: string[] = [];
    if (levelForXp(user.xp) >= 5) followUps.push('LEVEL_5');
    if (user.wallet >= 5000) followUps.push('BALANCE_5000');

    if (followUps.length) {
      unlocked.push(...(await this.unlock(tx, userId, followUps)));
      user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { xp: true, wallet: true },
      });
    }

    const level = levelForXp(user.xp);

    return {
      xp: user.xp,
      level,
      levelUp: level > levelForXp(xpBefore),
      unlocked,
    };
  }

  // Inserts each achievement at most once (primary key userId + code) and
  // credits its XP reward only when the row was really created.
  private async unlock(
    tx: Prisma.TransactionClient,
    userId: number,
    codes: string[],
  ): Promise<AchievementDefinition[]> {
    if (!codes.length) {
      return [];
    }

    const existing = await tx.userAchievement.findMany({
      where: { userId, achievementCode: { in: codes } },
      select: { achievementCode: true },
    });
    const owned = new Set(existing.map((a) => a.achievementCode));

    const unlocked: AchievementDefinition[] = [];

    for (const code of codes) {
      const definition = ACHIEVEMENTS.find((a) => a.code === code);
      if (!definition || owned.has(code)) continue;

      const created = await tx.userAchievement.createMany({
        data: [{ userId, achievementCode: code }],
        skipDuplicates: true,
      });

      if (created.count === 1) {
        unlocked.push(definition);
      }
    }

    const xpReward = unlocked.reduce((sum, a) => sum + a.xpReward, 0);

    if (xpReward > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: xpReward } },
      });
    }

    return unlocked;
  }

  // Sends the realtime notifications once the transaction has committed.
  notify(userId: number, outcome: GamificationOutcome) {
    if (outcome.unlocked.length) {
      this.events.emit('gamification.unlocked', {
        userId,
        achievements: outcome.unlocked,
      });
    }

    if (outcome.levelUp) {
      this.events.emit('gamification.levelup', {
        userId,
        level: outcome.level,
      });
    }
  }

  async claimDailyBonus(userId: number) {
    const now = new Date();
    const todayStart = startOfUtcDay(now);
    const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { xp: true, dailyStreak: true, lastDailyClaimAt: true },
      });

      const consecutive =
        user.lastDailyClaimAt && user.lastDailyClaimAt >= yesterdayStart;
      const dailyStreak = consecutive ? user.dailyStreak + 1 : 1;

      // The WHERE clause makes the claim atomic: if two requests arrive at the
      // same time, the second one no longer matches after the first commits.
      const claimed = await tx.user.updateMany({
        where: {
          id: userId,
          OR: [
            { lastDailyClaimAt: null },
            { lastDailyClaimAt: { lt: todayStart } },
          ],
        },
        data: {
          lastDailyClaimAt: now,
          dailyStreak,
          xp: { increment: DAILY_BONUS_XP },
        },
      });

      if (claimed.count === 0) {
        throw new BadRequestException(
          'Daily bonus already claimed today. Come back tomorrow!',
        );
      }

      const wallet = await this.wallet.credit(
        tx,
        userId,
        DAILY_BONUS_AMOUNT,
        TransactionType.DAILY_BONUS,
      );

      const outcome = await this.evaluate(
        tx,
        userId,
        user.xp,
        dailyStreak >= 3 ? ['DAILY_3'] : [],
      );

      return { wallet, dailyStreak, outcome };
    });

    this.events.emit('wallet.changed', { userId, wallet: result.wallet });
    this.notify(userId, result.outcome);

    return {
      amount: DAILY_BONUS_AMOUNT,
      xpGained: DAILY_BONUS_XP,
      wallet: result.wallet,
      dailyStreak: result.dailyStreak,
      ...levelProgress(result.outcome.xp),
      levelUp: result.outcome.levelUp,
      unlocked: result.outcome.unlocked,
    };
  }

  async getProgress(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        xp: true,
        wallet: true,
        wins: true,
        losses: true,
        currentStreak: true,
        bestStreak: true,
        dailyStreak: true,
        lastDailyClaimAt: true,
        achievements: {
          select: { achievementCode: true, unlockedAt: true },
        },
      },
    });

    const todayStart = startOfUtcDay(new Date());
    const available =
      !user.lastDailyClaimAt || user.lastDailyClaimAt < todayStart;
    const unlockedAt = new Map(
      user.achievements.map((a) => [a.achievementCode, a.unlockedAt]),
    );

    return {
      ...levelProgress(user.xp),
      wallet: user.wallet,
      wins: user.wins,
      losses: user.losses,
      currentStreak: user.currentStreak,
      bestStreak: user.bestStreak,
      dailyBonus: {
        amount: DAILY_BONUS_AMOUNT,
        xp: DAILY_BONUS_XP,
        streak: user.dailyStreak,
        available,
        nextAvailableAt: available
          ? null
          : new Date(todayStart.getTime() + DAY_MS),
      },
      achievements: ACHIEVEMENTS.map((a) => ({
        ...a,
        unlocked: unlockedAt.has(a.code),
        unlockedAt: unlockedAt.get(a.code) ?? null,
      })),
    };
  }

  getAchievementCatalog() {
    return ACHIEVEMENTS;
  }

  async getLeaderboard(
    sort: LeaderboardSort,
    limit: number,
    currentUserId?: number,
  ) {
    const sortField = sort === 'xp' ? 'xp' : sort === 'wins' ? 'wins' : 'wallet';

    const select = {
      id: true,
      username: true,
      updatedAt: true,
      wallet: true,
      xp: true,
      wins: true,
      losses: true,
      bestStreak: true,
      _count: { select: { achievements: true } },
    } satisfies Prisma.UserSelect;

    const users = await this.prisma.user.findMany({
      orderBy: [{ [sortField]: 'desc' }, { id: 'asc' }],
      take: limit,
      select,
    });

    const toEntry = (user: (typeof users)[number], rank: number) => {
      const played = user.wins + user.losses;

      return {
        rank,
        id: user.id,
        username: user.username,
        avatarUrl: avatarUrl(user),
        wallet: user.wallet,
        xp: user.xp,
        level: levelForXp(user.xp),
        wins: user.wins,
        losses: user.losses,
        winRate: played ? user.wins / played : 0,
        bestStreak: user.bestStreak,
        achievements: user._count.achievements,
      };
    };

    const entries = users.map((user, index) => toEntry(user, index + 1));

    let me = entries.find((e) => e.id === currentUserId) ?? null;

    // Logged-in user outside the top N: compute their rank separately.
    if (!me && currentUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: currentUserId },
        select,
      });

      if (user) {
        const ahead = await this.prisma.user.count({
          where: {
            OR: [
              { [sortField]: { gt: user[sortField] } },
              { [sortField]: user[sortField], id: { lt: user.id } },
            ],
          },
        });
        me = toEntry(user, ahead + 1);
      }
    }

    const totalPlayers = await this.prisma.user.count();

    return { sort, totalPlayers, entries, me };
  }
}
