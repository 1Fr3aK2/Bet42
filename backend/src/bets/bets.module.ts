import { Module } from '@nestjs/common';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../crypto/crypto.module';
import { WalletModule } from '../wallet/wallet.module';
import { GamificationModule } from '../gamification/gamification.module';
import { RateLimiterModule } from '../rate-limiter/rate-limiter.module';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { BetsSettlementService } from './bets-settlement.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CryptoModule,
    WalletModule,
    GamificationModule,
    RateLimiterModule,
  ],
  controllers: [BetsController],
  providers: [
    BetsService,
    BetsSettlementService,
    // Business metrics scraped by Prometheus from /metrics.
    makeCounterProvider({
      name: 'bets_placed_total',
      help: 'Number of bets placed',
      labelNames: ['coin', 'direction', 'duration'],
    }),
    makeCounterProvider({
      name: 'bets_wagered_tdollars_total',
      help: 'Total T$ staked on bets',
      labelNames: ['coin'],
    }),
    makeCounterProvider({
      name: 'bets_settled_total',
      help: 'Number of bets settled, by result',
      labelNames: ['status', 'coin'],
    }),
  ],
  exports: [BetsService],
})
export class BetsModule {}
