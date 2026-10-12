import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import {
  CryptoTicker,
  KRAKEN_SYMBOLS,
  KrakenService,
} from '../crypto/kraken.service';

// Kraken can send several ticker updates per second. Updates are merged and
// broadcast at most once per TICKER_THROTTLE_MS for each coin.
const TICKER_THROTTLE_MS = 500;

// Many bets settle at the same time; tell clients to refresh the
// leaderboard at most once per LEADERBOARD_DEBOUNCE_MS.
const LEADERBOARD_DEBOUNCE_MS = 2000;

const userRoom = (userId: number) => `user:${userId}`;

// Events sent to the browser:
//   to everyone        crypto:snapshot (on connect), crypto:ticker, feed:bet,
//                      feed:settled, presence:update, leaderboard:changed
//   to one user's tabs bet:placed, bet:settled, wallet:update,
//                      achievement:unlocked, level:up, session:refresh,
//                      session:revoked
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // userId -> number of open sockets (a user can have several tabs).
  private readonly onlineUsers = new Map<number, number>();
  private connections = 0;

  private readonly pendingTickers = new Map<string, CryptoTicker>();
  private tickerTimer: NodeJS.Timeout | null = null;
  private leaderboardTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly kraken: KrakenService,
    @InjectMetric('ws_connected_clients')
    private readonly connectedGauge: Gauge<string>,
  ) {}

  // Guests can connect (prices, live feed). With a valid token in
  // handshake.auth.token the socket also joins its user's private room.
  async handleConnection(client: Socket) {
    this.connections++;

    const token = client.handshake.auth?.token;
    if (typeof token === 'string' && token) {
      try {
        const payload = await this.jwt.verifyAsync(token);
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true },
        });

        // The tab may have been closed while we were checking the token.
        if (!client.connected) return;

        if (user) {
          client.data.userId = user.id;
          client.join(userRoom(user.id));
          this.onlineUsers.set(user.id, (this.onlineUsers.get(user.id) ?? 0) + 1);
        } else {
          client.emit('session:revoked', { reason: 'Account not found' });
        }
      } catch {
        client.emit('session:revoked', { reason: 'Session expired' });
      }
    }

    client.emit(
      'crypto:snapshot',
      KRAKEN_SYMBOLS.map((symbol) => ({
        symbol,
        ticker: this.kraken.getTicker(symbol) ?? null,
        history: this.kraken.getHistory(symbol),
      })),
    );

    this.broadcastPresence();
  }

  handleDisconnect(client: Socket) {
    this.connections = Math.max(0, this.connections - 1);

    const userId = client.data.userId;
    if (userId) {
      const sockets = (this.onlineUsers.get(userId) ?? 1) - 1;
      if (sockets > 0) this.onlineUsers.set(userId, sockets);
      else this.onlineUsers.delete(userId);
    }

    this.broadcastPresence();
  }

  private broadcastPresence() {
    this.connectedGauge.set(this.connections);
    this.server.emit('presence:update', {
      connections: this.connections,
      traders: this.onlineUsers.size,
    });
  }

  @OnEvent('crypto.ticker')
  handleTicker(ticker: CryptoTicker) {
    this.pendingTickers.set(ticker.symbol, ticker);

    if (this.tickerTimer) return;

    this.tickerTimer = setTimeout(() => {
      this.tickerTimer = null;
      for (const latest of this.pendingTickers.values()) {
        this.server.emit('crypto:ticker', latest);
      }
      this.pendingTickers.clear();
    }, TICKER_THROTTLE_MS);
  }

  @OnEvent('bet.placed')
  handleBetPlaced({ bet, username }) {
    this.server.to(userRoom(bet.userId)).emit('bet:placed', bet);
    this.server.emit('feed:bet', { ...bet, username });
  }

  @OnEvent('bet.settled')
  handleBetSettled({ bet, username, wallet, currentStreak, xp, level }) {
    this.server
      .to(userRoom(bet.userId))
      .emit('bet:settled', { bet, wallet, currentStreak, xp, level });
    this.server.emit('feed:settled', { ...bet, username });
    this.scheduleLeaderboardUpdate();
  }

  @OnEvent('wallet.changed')
  handleWalletChanged({ userId, wallet }) {
    this.server.to(userRoom(userId)).emit('wallet:update', { wallet });
    this.scheduleLeaderboardUpdate();
  }

  @OnEvent('gamification.unlocked')
  handleAchievements({ userId, achievements }) {
    this.server.to(userRoom(userId)).emit('achievement:unlocked', { achievements });
  }

  @OnEvent('gamification.levelup')
  handleLevelUp({ userId, level }) {
    this.server.to(userRoom(userId)).emit('level:up', { level });
  }

  // Role or profile changed by an admin: the user's tabs reload their profile.
  @OnEvent('user.updated')
  handleUserUpdated({ userId }) {
    this.server.to(userRoom(userId)).emit('session:refresh');
    this.scheduleLeaderboardUpdate();
  }

  // Account deleted: log out every open tab of that user.
  @OnEvent('user.deleted')
  handleUserDeleted({ userId }) {
    this.server
      .to(userRoom(userId))
      .emit('session:revoked', { reason: 'Your account has been deleted' });
    this.server.in(userRoom(userId)).disconnectSockets(true);
    this.onlineUsers.delete(userId);
    this.scheduleLeaderboardUpdate();
  }

  private scheduleLeaderboardUpdate() {
    if (this.leaderboardTimer) return;

    this.leaderboardTimer = setTimeout(() => {
      this.leaderboardTimer = null;
      this.server.emit('leaderboard:changed');
    }, LEADERBOARD_DEBOUNCE_MS);
  }
}
