import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ForumModule } from './forum/forum.module';
import { ModerationModule } from './moderation/moderation.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { CryptoModule } from './crypto/crypto.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PublicApiModule } from './public-api/public-api.module';
import { BetsModule } from './bets/bets.module';
import { GamificationModule } from './gamification/gamification.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    ForumModule,
    ModerationModule,
	  AuthModule,
	  HealthModule,
    MetricsModule,
	CryptoModule,
	EventEmitterModule.forRoot(),
    PublicApiModule,
    BetsModule,
    GamificationModule,
    RealtimeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
