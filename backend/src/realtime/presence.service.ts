import { Injectable } from '@nestjs/common';

// Who is online right now: userId -> number of open sockets (tabs).
// Filled by RealtimeGateway, read by the friends list.
@Injectable()
export class PresenceService {
  private readonly sockets = new Map<number, number>();

  // Returns true when this is the user's first open socket (came online).
  connect(userId: number): boolean {
    const count = (this.sockets.get(userId) ?? 0) + 1;
    this.sockets.set(userId, count);
    return count === 1;
  }

  // Returns true when the user's last socket closed (went offline).
  disconnect(userId: number): boolean {
    const count = (this.sockets.get(userId) ?? 0) - 1;

    if (count > 0) {
      this.sockets.set(userId, count);
      return false;
    }

    return this.sockets.delete(userId);
  }

  remove(userId: number) {
    this.sockets.delete(userId);
  }

  isOnline(userId: number): boolean {
    return this.sockets.has(userId);
  }

  onlineCount(): number {
    return this.sockets.size;
  }
}
