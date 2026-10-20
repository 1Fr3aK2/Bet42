import { Module } from '@nestjs/common';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { RealtimeGateway } from './realtime.gateway';
import { PresenceService } from './presence.service';

@Module({
  imports: [AuthModule, PrismaModule, CryptoModule],
  providers: [
    RealtimeGateway,
    PresenceService,
    makeGaugeProvider({
      name: 'ws_connected_clients',
      help: 'Open Socket.IO connections',
    }),
  ],
  exports: [PresenceService],
})
export class RealtimeModule {}
