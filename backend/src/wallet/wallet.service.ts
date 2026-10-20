import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';

// Every change to User.wallet must go through one of these helpers, inside the
// same database transaction, so the WalletTransaction ledger never drifts from
// the real balance.
@Injectable()
export class WalletService {
  // Takes `amount` from the wallet only if the balance is high enough.
  // The check and the update are a single SQL statement, so two concurrent
  // bets can never spend the same T$ twice. Returns the new balance, or null
  // if the balance was too low.
  async debit(
    tx: Prisma.TransactionClient,
    userId: number,
    amount: number,
    type: TransactionType,
    betId?: number,
  ): Promise<number | null> {
    const updated = await tx.user.updateMany({
      where: { id: userId, wallet: { gte: amount } },
      data: { wallet: { decrement: amount } },
    });

    if (updated.count === 0) {
      return null;
    }

    // The row stays locked by our UPDATE until the transaction commits,
    // so this read sees exactly the balance we just wrote.
    const { wallet } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { wallet: true },
    });

    await this.record(tx, userId, type, -amount, wallet, betId);

    return wallet;
  }

  async credit(
    tx: Prisma.TransactionClient,
    userId: number,
    amount: number,
    type: TransactionType,
    betId?: number,
  ): Promise<number> {
    const { wallet } = await tx.user.update({
      where: { id: userId },
      data: { wallet: { increment: amount } },
      select: { wallet: true },
    });

    await this.record(tx, userId, type, amount, wallet, betId);

    return wallet;
  }

  // Sets an exact balance (admin correction) and records the difference.
  async set(
    tx: Prisma.TransactionClient,
    userId: number,
    newBalance: number,
  ): Promise<number> {
    const { wallet: before } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { wallet: true },
    });

    if (before === newBalance) {
      return before;
    }

    await tx.user.update({
      where: { id: userId },
      data: { wallet: newBalance },
    });

    await this.record(
      tx,
      userId,
      TransactionType.ADMIN_ADJUSTMENT,
      newBalance - before,
      newBalance,
    );

    return newBalance;
  }

  record(
    tx: Prisma.TransactionClient,
    userId: number,
    type: TransactionType,
    amount: number,
    balanceAfter: number,
    betId?: number,
  ) {
    return tx.walletTransaction.create({
      data: { userId, type, amount, balanceAfter, betId },
    });
  }
}
