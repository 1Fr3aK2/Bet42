import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Bet, BetStatus, Prisma, TransactionType } from '@prisma/client';
import { Counter } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { GamificationService } from '../gamification/gamification.service';
import { XP_PER_BET } from '../gamification/gamification.constants';
import { KrakenService } from '../crypto/kraken.service';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';
import { PlaceBetDto } from './dto/place-bet.dto';
import { ListBetsDto } from './dto/list-bets.dto';
import {
  BET_DURATIONS,
  MAX_BET,
  MAX_PENDING_BETS,
  MIN_BET,
  PAYOUT_MULTIPLIER,
  potentialPayout,
  STARTING_BALANCE,
  SUPPORTED_COINS,
} from './bets.constants';

// Shape sent to the browser: adds the values the UI needs to display.
export function serializeBet(bet: Bet) {
  const settled = bet.status !== BetStatus.PENDING;

  return {
    ...bet,
    potentialPayout: potentialPayout(bet.amount),
    profit: settled ? bet.payout - bet.amount : null,
  };
}

@Injectable()
export class BetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly gamification: GamificationService,
    private readonly kraken: KrakenService,
    private readonly rateLimiter: RateLimiterService,
    private readonly events: EventEmitter2,
    @InjectMetric('bets_placed_total')
    private readonly betsPlaced: Counter<string>,
    @InjectMetric('bets_wagered_tdollars_total')
    private readonly betsWagered: Counter<string>,
  ) {}

  getRules() {
    return {
      coins: SUPPORTED_COINS,
      durations: BET_DURATIONS,
      payoutMultiplier: PAYOUT_MULTIPLIER,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      maxPendingBets: MAX_PENDING_BETS,
      startingBalance: STARTING_BALANCE,
      feedHealthy: this.kraken.isFeedHealthy(),
    };
  }

  async placeBet(userId: number, dto: PlaceBetDto) {
    const allowed = await this.rateLimiter.checkLimit(`bets:${userId}`, 20, 60);
    if (!allowed) {
      throw new HttpException(
        'Too many bets in a short time. Please wait a moment.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // The entry price is always taken by the server, never sent by the client.
    const entryPrice = this.kraken.getLivePrice(dto.coin);
    if (entryPrice === null) {
      throw new ServiceUnavailableException(
        'Live prices are temporarily unavailable. Try again in a moment.',
      );
    }

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + dto.duration * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const pending = await tx.bet.count({
        where: { userId, status: BetStatus.PENDING },
      });

      if (pending >= MAX_PENDING_BETS) {
        throw new BadRequestException(
          `You can have at most ${MAX_PENDING_BETS} open bets at the same time.`,
        );
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { username: true, xp: true },
      });

      const bet = await tx.bet.create({
        data: {
          userId,
          coin: dto.coin,
          direction: dto.direction,
          amount: dto.amount,
          duration: dto.duration,
          entryPrice,
          createdAt,
          expiresAt,
        },
      });

      // Atomic "check balance and take the stake". If it fails, the whole
      // transaction (including the bet above) is rolled back.
      const wallet = await this.wallet.debit(
        tx,
        userId,
        dto.amount,
        TransactionType.BET_STAKE,
        bet.id,
      );

      if (wallet === null) {
        throw new BadRequestException('Insufficient balance for this bet.');
      }

      await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: XP_PER_BET } },
      });

      const outcome = await this.gamification.evaluate(
        tx,
        userId,
        user.xp,
        await this.placementAchievements(tx, userId, dto.amount),
      );

      return { bet, wallet, username: user.username, outcome };
    });

    this.betsPlaced.inc({
      coin: dto.coin,
      direction: dto.direction,
      duration: String(dto.duration),
    });
    this.betsWagered.inc({ coin: dto.coin }, dto.amount);

    this.events.emit('bet.placed', {
      bet: serializeBet(result.bet),
      username: result.username,
    });
    this.events.emit('wallet.changed', { userId, wallet: result.wallet });
    this.gamification.notify(userId, result.outcome);

    return {
      bet: serializeBet(result.bet),
      wallet: result.wallet,
      xp: result.outcome.xp,
      level: result.outcome.level,
      unlocked: result.outcome.unlocked,
    };
  }

  private async placementAchievements(
    tx: Prisma.TransactionClient,
    userId: number,
    amount: number,
  ): Promise<string[]> {
    const totalBets = await tx.bet.count({ where: { userId } });
    const coins = await tx.bet.findMany({
      where: { userId },
      distinct: ['coin'],
      select: { coin: true },
    });

    const codes = ['FIRST_BET'];
    if (totalBets >= 10) codes.push('BETS_10');
    if (totalBets >= 50) codes.push('BETS_50');
    if (amount >= 1000) codes.push('HIGH_ROLLER');
    if (coins.length >= 2) codes.push('DIVERSIFIED');

    return codes;
  }

  async listBets(userId: number, query: ListBetsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.BetWhereInput = {
      userId,
      status: query.status,
      coin: query.coin,
    };

    const [total, bets] = await this.prisma.$transaction([
      this.prisma.bet.count({ where }),
      this.prisma.bet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: bets.map(serializeBet),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async activeBets(userId: number) {
    const bets = await this.prisma.bet.findMany({
      where: { userId, status: BetStatus.PENDING },
      orderBy: { expiresAt: 'asc' },
    });

    return bets.map(serializeBet);
  }

  // Latest bets of all players, for the public "live activity" feed.
  async recentActivity(limit = 15) {
    const bets = await this.prisma.bet.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { username: true } } },
    });

    return bets.map(({ user, ...bet }) => ({
      ...serializeBet(bet),
      username: user.username,
    }));
  }
}
