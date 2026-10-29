import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../crypto/crypto.module';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';

@Module({
  imports: [PrismaModule, AuthModule, CryptoModule],
  controllers: [BetsController],
  providers: [BetsService],
})
export class BetsModule {}
