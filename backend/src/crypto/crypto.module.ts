import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CryptoController } from './crypto.controller';
import { CryptoService } from './crypto.service';
import { KrakenService } from './kraken.service';

// Prices are pushed to browsers by RealtimeGateway (src/realtime).
@Module({
  imports: [HttpModule],
  controllers: [CryptoController],
  providers: [CryptoService,
	KrakenService,
  ],
  exports: [KrakenService],

})
export class CryptoModule {}
