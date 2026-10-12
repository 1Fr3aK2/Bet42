import { Controller, Get, Param, Query } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { KrakenService } from './kraken.service';


@Controller('crypto')
export class CryptoController {
	constructor(
		private readonly cryptoService: CryptoService,
		private readonly krakenService: KrakenService,
	  ) {}

	@Get(':coin')
	getCurrentPrice(@Param('coin') coin: string) {
	    const symbol = `${coin.toUpperCase()}/EUR`;

	    return this.krakenService.getTicker(symbol);
	}

  // Last 12 hours of 1-minute candles (open, high, low, close, volume).
  @Get(':coin/candles')
  getCandles(@Param('coin') coin: string) {
    return this.krakenService.getCandles(`${coin.toUpperCase()}/EUR`);
  }

  @Get(':coin/history')
  getHistory(
    @Param('coin') coin: string,
    @Query('days') days?: string,
  ) {
    return this.cryptoService.getHistory(
      coin,
      days ? Number(days) : 7,
    );
  }
}