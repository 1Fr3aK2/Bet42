import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomaticModerationService } from './automatic-moderation.service';
import { ManualModerationService } from './manual-moderation.service';

@Module({
  imports: [PrismaModule],
  providers: [
    AutomaticModerationService,
    ManualModerationService,
  ],
  exports: [
    AutomaticModerationService,
    ManualModerationService,
  ],
})
export class ModerationModule {}
