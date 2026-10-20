import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import {
  Bet,
  BetDirection,
  BetStatus,
  TransactionType,
} from '@prisma/client';
import { Counter } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { GamificationService } from '../gamification/gamification.service';
import { XP_PER_WIN } from '../gamification/gamification.constants';
import { KrakenService } from '../crypto/kraken.service';
import {
  potentialPayout,
  SETTLEMENT_GRACE_MS,
  SETTLEMENT_INTERVAL_MS,
} from './bets.constants';
import { serializeBet } from './bets.service';

// Decides the result of a bet from its entry price and the price at expiry.
// Same price = nobody was right, so the stake is returned.
export function decideOutcome(bet: Pick<Bet, 'direction' | 'entryPrice' | 'amount'>, exitPrice: number) {
  if (exitPrice === bet.entryPrice) {
    return { status: BetStatus.REFUNDED, payout: bet.amount };
  }

  const wentUp = exitPrice > bet.entryPrice;
  const won = (bet.direction === BetDirection.UP) === wentUp;

  return won
    ? { status: BetStatus.WON, payout: potentialPayout(bet.amount) }
    : { status: BetStatus.LOST, payout: 0 };
}

// Every second, settles the bets whose time is up, using the live Kraken
// price. Because it only looks at the database, bets that expired while the
// backend was down are settled as soon as it starts again.
@Injectable()
export class BetsSettlementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BetsSettlementService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly gamification: GamificationService,
    private readonly kraken: KrakenService,
    private readonly events: EventEmitter2,
    @InjectMetric('bets_settled_total')
    private readonly betsSettled: Counter<string>,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.settleDueBets(), SETTLEMENT_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async settleDueBets() {
    // Skip a tick if the previous one is still running.
    if (this.running) return;
    this.running = true;

    try {
      const due = await this.prisma.bet.findMany({
        where: { status: BetStatus.PENDING, expiresAt: { lte: new Date() } },
        orderBy: { expiresAt: 'asc' },
        take: 200,
      });

      for (const bet of due) {
        try {
          await this.settle(bet);
        } catch (error) {
          this.logger.error(`Failed to settle bet ${bet.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Settlement loop failed: ${error.message}`);
    } finally {
      this.running = false;
    }
  }

  private async settle(bet: Bet) {
    const price = this.kraken.getLivePrice(bet.coin);

    let outcome: { status: BetStatus; payout: number };

    if (price === null) {
      // Feed down: wait for it to come back, unless it has been too long.
      if (Date.now() - bet.expiresAt.getTime() < SETTLEMENT_GRACE_MS) {
        return;
      }
      outcome = { status: BetStatus.REFUNDED, payout: bet.amount };
      this.logger.warn(`Bet ${bet.id} refunded: no live price after expiry`);
    } else {
      outcome = decideOutcome(bet, price);
    }

    const won = outcome.status === BetStatus.WON;
    const lost = outcome.status === BetStatus.LOST;

    const result = await this.prisma.$transaction(async (tx) => {
      // Only one settlement can win this update, so a bet is never paid twice.
      const claimed = await tx.bet.updateMany({
        where: { id: bet.id, status: BetStatus.PENDING },
        data: {
          status: outcome.status,
          exitPrice: price,
          payout: outcome.payout,
          resolvedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        return null;
      }

      const before = await tx.user.findUniqueOrThrow({
        where: { id: bet.userId },
        select: { xp: true, username: true },
      });

      if (outcome.payout > 0) {
        await this.wallet.credit(
          tx,
          bet.userId,
          outcome.payout,
          won ? TransactionType.BET_PAYOUT : TransactionType.BET_REFUND,
          bet.id,
        );
      }

      let stats = await tx.user.findUniqueOrThrow({
        where: { id: bet.userId },
        select: { wallet: true, currentStreak: true, bestStreak: true },
      });

      if (won || lost) {
        stats = await tx.user.update({
          where: { id: bet.userId },
          data: {
            wins: won ? { increment: 1 } : undefined,
            losses: lost ? { increment: 1 } : undefined,
            currentStreak: won ? { increment: 1 } : 0,
            xp: won ? { increment: XP_PER_WIN } : undefined,
          },
          select: { wallet: true, currentStreak: true, bestStreak: true },
        });

        if (stats.currentStreak > stats.bestStreak) {
          await tx.user.update({
            where: { id: bet.userId },
            data: { bestStreak: stats.currentStreak },
          });
        }
      }

      const codes: string[] = [];
      if (won) {
        codes.push('FIRST_WIN');
        if (stats.currentStreak >= 3) codes.push('STREAK_3');
        if (stats.currentStreak >= 5) codes.push('STREAK_5');
        if (bet.duration >= 300) codes.push('PATIENT');
      }

      const gamification = await this.gamification.evaluate(
        tx,
        bet.userId,
        before.xp,
        codes,
      );

      const settled = await tx.bet.findUniqueOrThrow({ where: { id: bet.id } });

      return {
        settled,
        username: before.username,
        wallet: stats.wallet,
        currentStreak: stats.currentStreak,
        gamification,
      };
    });

    if (!result) return;

    this.betsSettled.inc({ status: outcome.status, coin: bet.coin });

    this.events.emit('bet.settled', {
      bet: serializeBet(result.settled),
      username: result.username,
      wallet: result.wallet,
      currentStreak: result.currentStreak,
      xp: result.gamification.xp,
      level: result.gamification.level,
    });
    this.events.emit('wallet.changed', {
      userId: bet.userId,
      wallet: result.wallet,
    });
    this.gamification.notify(bet.userId, result.gamification);
  }
}
