import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
  } from '@nestjs/common';
  import WebSocket = require('ws');
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CryptoTicker {
	symbol: string;
	bid: number;
	ask: number;
	last: number;
	volume: number;
	vwap: number;
	low: number;
	high: number;
	change: number;
	change_pct: number;
	timestamp: string;
}

export interface PricePoint {
	time: number;
	price: number;
}

// Pairs streamed from Kraken. The bets module only accepts coins listed here.
export const KRAKEN_SYMBOLS = ['BTC/EUR', 'ETH/EUR'];

// Rolling window of prices kept in memory so a client that connects
// gets the last 10 minutes of the chart immediately.
const HISTORY_WINDOW_MS = 10 * 60 * 1000;
const HISTORY_SAMPLE_MS = 1000;

// Kraken sends a heartbeat every second; if nothing arrives for this long
// the feed is considered down and prices must not be used to settle bets.
const FEED_STALE_MS = 15 * 1000;

  @Injectable()
  export class KrakenService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(KrakenService.name);

	private ws: WebSocket | null = null;
	private stopped = false;
	private lastMessageAt = 0;

	constructor(
		private readonly eventEmitter: EventEmitter2,
	  ) {}

	private tickers = new Map<string, CryptoTicker>();
	private history = new Map<string, PricePoint[]>();

	onModuleInit() {
	  this.connect();
	}

	onModuleDestroy() {
	  this.stopped = true;
	  this.ws?.close();
	}

	private connect() {
	  this.ws = new WebSocket('wss://ws.kraken.com/v2');

	  this.ws.on('open', () => {
		this.logger.log('Connected to Kraken');

		this.subscribe();
	  });

	  this.ws.on('message', (message) => {
		this.lastMessageAt = Date.now();
		this.handleMessage(message.toString());
	  });

	  this.ws.on('error', (error) => {
		this.logger.error(`Kraken WebSocket error: ${error.message}`);
	  });

	  this.ws.on('close', () => {
		if (this.stopped) {
		  return;
		}

		this.logger.warn('Kraken WebSocket disconnected');

		// Reconectar depois de 5 segundos
		setTimeout(() => {
		  this.connect();
		}, 5000);
	  });
	}

	private subscribe() {
	  const message = {
		method: 'subscribe',
		params: {
		  channel: 'ticker',
		  symbol: KRAKEN_SYMBOLS,
		},
	  };

	  this.ws?.send(JSON.stringify(message));

	  this.logger.log(`Subscribed to ${KRAKEN_SYMBOLS.join(', ')}`);
	}

	private handleMessage(message: string) {
	  try {
		const data = JSON.parse(message);

		if (data.channel !== 'ticker') {
		  return;
		}

		if (!data.data || !data.data.length) {
		  return;
		}

		const ticker = data.data[0];

		const crypto: CryptoTicker = {
		  symbol: ticker.symbol,
		  bid: ticker.bid,
		  ask: ticker.ask,
		  last: ticker.last,
		  volume: ticker.volume,
		  vwap: ticker.vwap,
		  low: ticker.low,
		  high: ticker.high,
		  change: ticker.change,
		  change_pct: ticker.change_pct,
		  timestamp: ticker.timestamp,
		};

		this.tickers.set(ticker.symbol, crypto);
		this.recordHistory(ticker.symbol, ticker.last);

		this.eventEmitter.emit('crypto.ticker', crypto);

		this.logger.debug(
		  `${ticker.symbol}: ${ticker.last} EUR`,
		);
	  } catch (error) {
		this.logger.error('Failed to parse Kraken message');
	  }
	}

	private recordHistory(symbol: string, price: number) {
	  const now = Date.now();
	  const points = this.history.get(symbol) ?? [];
	  const last = points[points.length - 1];

	  // At most one point per second, the latest price wins.
	  if (last && now - last.time < HISTORY_SAMPLE_MS) {
		last.price = price;
	  } else {
		points.push({ time: now, price });
	  }

	  const cutoff = now - HISTORY_WINDOW_MS;
	  while (points.length && points[0].time < cutoff) {
		points.shift();
	  }

	  this.history.set(symbol, points);
	}

	getTicker(symbol: string): CryptoTicker | undefined {
	  return this.tickers.get(symbol);
	}

	getAllTickers(): CryptoTicker[] {
	  return Array.from(this.tickers.values());
	}

	getHistory(symbol: string): PricePoint[] {
	  return [...(this.history.get(symbol) ?? [])];
	}

	// True while the Kraken connection is open and still sending messages.
	isFeedHealthy(): boolean {
	  return (
		this.ws?.readyState === WebSocket.OPEN &&
		Date.now() - this.lastMessageAt < FEED_STALE_MS
	  );
	}

	// Latest traded price of a coin in EUR, or null if the feed is down
	// or no trade has been received yet. Used to open and settle bets.
	getLivePrice(coin: string): number | null {
	  if (!this.isFeedHealthy()) {
		return null;
	  }

	  const ticker = this.tickers.get(`${coin}/EUR`);

	  return ticker && Number.isFinite(ticker.last) ? ticker.last : null;
	}
  }
