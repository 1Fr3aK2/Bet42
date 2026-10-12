import { BadRequestException, Injectable } from '@nestjs/common';
import { BetStatus, Prisma } from '@prisma/client';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyticsQueryDto,
  ExportFormat,
  ExportQueryDto,
} from './dto/analytics-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const MAX_SERIES_POINTS = 500;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Columns read from the Bet table for every statistic below.
const BET_FIELDS = {
  id: true,
  userId: true,
  coin: true,
  direction: true,
  duration: true,
  amount: true,
  entryPrice: true,
  exitPrice: true,
  payout: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
} satisfies Prisma.BetSelect;

type BetRow = Prisma.BetGetPayload<{ select: typeof BET_FIELDS }>;

interface Aggregate {
  bets: number;
  won: number;
  lost: number;
  refunded: number;
  pending: number;
  wagered: number;
  profit: number;
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const isSettled = (bet: BetRow) => bet.status !== BetStatus.PENDING;

// Profit of a settled bet from the player's point of view.
const betProfit = (bet: BetRow) => (isSettled(bet) ? bet.payout - bet.amount : 0);

function emptyAggregate(): Aggregate {
  return { bets: 0, won: 0, lost: 0, refunded: 0, pending: 0, wagered: 0, profit: 0 };
}

function addToAggregate(agg: Aggregate, bet: BetRow) {
  agg.bets++;
  agg.wagered += bet.amount;
  agg.profit += betProfit(bet);

  if (bet.status === BetStatus.WON) agg.won++;
  else if (bet.status === BetStatus.LOST) agg.lost++;
  else if (bet.status === BetStatus.REFUNDED) agg.refunded++;
  else agg.pending++;
}

function withWinRate(agg: Aggregate) {
  const decided = agg.won + agg.lost;
  return { ...agg, winRate: decided ? agg.won / decided : 0 };
}

function breakdown(bets: BetRow[], keyOf: (bet: BetRow) => string) {
  const groups = new Map<string, Aggregate>();

  for (const bet of bets) {
    const key = keyOf(bet);
    if (!groups.has(key)) groups.set(key, emptyAggregate());
    addToAggregate(groups.get(key), bet);
  }

  return [...groups.entries()]
    .map(([key, agg]) => ({ key, ...withWinRate(agg) }))
    .sort((a, b) => b.bets - a.bets);
}

// Keeps at most `max` evenly spaced points (always the first and the last).
function downsample<T>(points: T[], max = MAX_SERIES_POINTS): T[] {
  if (points.length <= max) return points;

  return Array.from(
    { length: max },
    (_, i) => points[Math.round((i * (points.length - 1)) / (max - 1))],
  );
}

// One entry per day of the range, so charts also show days without bets.
function daysBetween(from: Date, to: Date): string[] {
  const days: string[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());

  for (let t = start; t <= to.getTime(); t += DAY_MS) {
    days.push(dayKey(new Date(t)));
  }

  return days;
}

function longestWinStreak(bets: BetRow[]) {
  let best = 0;
  let current = 0;

  for (const bet of bets) {
    if (bet.status === BetStatus.WON) best = Math.max(best, ++current);
    else if (bet.status === BetStatus.LOST) current = 0;
  }

  return best;
}

const tdollars = (n: number) => `${Math.round(n).toLocaleString('en-US')} T$`;
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Default range: the last 30 days, today included.
  resolveRange(query: AnalyticsQueryDto) {
    const parse = (value: string, endOfDay: boolean) =>
      DATE_ONLY.test(value)
        ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
        : new Date(value);

    const to = query.to ? parse(query.to, true) : new Date();
    const from = query.from
      ? parse(query.from, false)
      : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) - 29 * DAY_MS);

    if (from > to) {
      throw new BadRequestException('"from" must be before "to"');
    }

    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw new BadRequestException(`The date range cannot exceed ${MAX_RANGE_DAYS} days`);
    }

    return { from, to };
  }

  private betWhere(query: AnalyticsQueryDto, from: Date, to: Date): Prisma.BetWhereInput {
    return {
      createdAt: { gte: from, lte: to },
      coin: query.coin,
      duration: query.duration,
      direction: query.direction,
    };
  }

  private summarize(bets: BetRow[]) {
    const total = emptyAggregate();
    bets.forEach((bet) => addToAggregate(total, bet));

    const settled = bets
      .filter(isSettled)
      .sort((a, b) => a.resolvedAt.getTime() - b.resolvedAt.getTime());
    const profits = settled.map(betProfit);
    const settledWagered = settled.reduce((sum, bet) => sum + bet.amount, 0);

    return {
      ...withWinRate(total),
      avgStake: total.bets ? total.wagered / total.bets : 0,
      biggestWin: profits.reduce((max, p) => Math.max(max, p), 0),
      biggestLoss: profits.reduce((max, p) => Math.max(max, -p), 0),
      roi: settledWagered ? total.profit / settledWagered : 0,
      bestStreak: longestWinStreak(settled),
    };
  }

  async getUserAnalytics(userId: number, query: AnalyticsQueryDto) {
    const { from, to } = this.resolveRange(query);

    const [bets, user, ledgerBefore, ledger] = await Promise.all([
      this.prisma.bet.findMany({
        where: { userId, ...this.betWhere(query, from, to) },
        orderBy: { createdAt: 'asc' },
        select: BET_FIELDS,
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { wallet: true },
      }),
      // Balance at the start of the range = last ledger entry before it.
      this.prisma.walletTransaction.findFirst({
        where: { userId, createdAt: { lt: from } },
        orderBy: { id: 'desc' },
        select: { balanceAfter: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: { userId, createdAt: { gte: from, lte: to } },
        orderBy: { id: 'asc' },
        select: { createdAt: true, balanceAfter: true, type: true },
      }),
    ]);

    // Daily buckets
    const days = new Map(daysBetween(from, to).map((d) => [d, emptyAggregate()]));
    for (const bet of bets) {
      const bucket = days.get(dayKey(bet.createdAt));
      if (bucket) addToAggregate(bucket, bet);
    }

    // Cumulative profit, in settlement order
    let running = 0;
    const cumulativeProfit = bets
      .filter(isSettled)
      .sort((a, b) => a.resolvedAt.getTime() - b.resolvedAt.getTime())
      .map((bet) => ({
        time: bet.resolvedAt.getTime(),
        profit: (running += betProfit(bet)),
      }));

    const balanceHistory = [
      ...(ledgerBefore ? [{ time: from.getTime(), balance: ledgerBefore.balanceAfter }] : []),
      ...ledger.map((t) => ({ time: t.createdAt.getTime(), balance: t.balanceAfter })),
    ];

    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, ...emptyAggregate() }));
    bets.forEach((bet) => addToAggregate(byHour[bet.createdAt.getUTCHours()], bet));

    return {
      range: { from, to },
      filters: { coin: query.coin ?? null, duration: query.duration ?? null, direction: query.direction ?? null },
      currentBalance: user.wallet,
      summary: this.summarize(bets),
      timeline: [...days.entries()].map(([date, agg]) => ({ date, ...withWinRate(agg) })),
      cumulativeProfit: downsample(cumulativeProfit),
      balanceHistory: downsample(balanceHistory),
      byCoin: breakdown(bets, (bet) => bet.coin),
      byDirection: breakdown(bets, (bet) => bet.direction),
      byDuration: breakdown(bets, (bet) => `${bet.duration / 60} min`),
      byHour: byHour.map((h) => ({ ...h, winRate: withWinRate(h).winRate })),
      outcomes: [BetStatus.WON, BetStatus.LOST, BetStatus.REFUNDED, BetStatus.PENDING].map(
        (status) => ({ status, count: bets.filter((b) => b.status === status).length }),
      ),
    };
  }

  // Whole-platform view for administrators.
  async getPlatformAnalytics(query: AnalyticsQueryDto) {
    const { from, to } = this.resolveRange(query);

    const [bets, totalUsers, newUsers] = await Promise.all([
      this.prisma.bet.findMany({
        where: this.betWhere(query, from, to),
        orderBy: { createdAt: 'asc' },
        select: BET_FIELDS,
      }),
      this.prisma.user.count(),
      this.prisma.user.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
    ]);

    const days = new Map(
      daysBetween(from, to).map((d) => [
        d,
        { ...emptyAggregate(), newUsers: 0, traders: new Set<number>() },
      ]),
    );

    for (const bet of bets) {
      const bucket = days.get(dayKey(bet.createdAt));
      if (!bucket) continue;
      addToAggregate(bucket, bet);
      bucket.traders.add(bet.userId);
    }

    for (const user of newUsers) {
      const bucket = days.get(dayKey(user.createdAt));
      if (bucket) bucket.newUsers++;
    }

    // Players with the best results in the range
    const perUser = new Map<number, Aggregate>();
    for (const bet of bets) {
      if (!perUser.has(bet.userId)) perUser.set(bet.userId, emptyAggregate());
      addToAggregate(perUser.get(bet.userId), bet);
    }

    const top = [...perUser.entries()]
      .sort((a, b) => b[1].profit - a[1].profit)
      .slice(0, 5);
    const names = await this.prisma.user.findMany({
      where: { id: { in: top.map(([id]) => id) } },
      select: { id: true, username: true },
    });

    const summary = this.summarize(bets);

    return {
      range: { from, to },
      summary: {
        ...summary,
        totalUsers,
        newUsers: newUsers.length,
        activeTraders: perUser.size,
        // The house wins what the players lose.
        houseProfit: -summary.profit,
      },
      timeline: [...days.entries()].map(([date, { traders, ...agg }]) => ({
        date,
        ...withWinRate(agg),
        activeTraders: traders.size,
      })),
      byCoin: breakdown(bets, (bet) => bet.coin),
      byDirection: breakdown(bets, (bet) => bet.direction),
      outcomes: [BetStatus.WON, BetStatus.LOST, BetStatus.REFUNDED, BetStatus.PENDING].map(
        (status) => ({ status, count: bets.filter((b) => b.status === status).length }),
      ),
      topTraders: top.map(([id, agg]) => ({
        id,
        username: names.find((n) => n.id === id)?.username ?? 'deleted',
        ...withWinRate(agg),
      })),
    };
  }

  async exportUserBets(userId: number, username: string, query: ExportQueryDto) {
    const { from, to } = this.resolveRange(query);

    const bets = await this.prisma.bet.findMany({
      where: { userId, ...this.betWhere(query, from, to) },
      orderBy: { createdAt: 'asc' },
      select: BET_FIELDS,
    });

    const rows = bets.map((bet) => ({
      id: bet.id,
      createdAt: bet.createdAt.toISOString(),
      coin: bet.coin,
      direction: bet.direction,
      durationSeconds: bet.duration,
      amount: bet.amount,
      entryPrice: bet.entryPrice,
      exitPrice: bet.exitPrice,
      status: bet.status,
      payout: bet.payout,
      profit: isSettled(bet) ? betProfit(bet) : null,
      resolvedAt: bet.resolvedAt?.toISOString() ?? null,
    }));

    const safeName = username.replace(/[^A-Za-z0-9_-]/g, '_');
    const filename = `transcendence-bets-${safeName}-${dayKey(from)}-to-${dayKey(to)}`;
    const format: ExportFormat = query.format;

    if (format === 'json') {
      return {
        filename: `${filename}.json`,
        contentType: 'application/json',
        body: JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            user: username,
            range: { from, to },
            filters: { coin: query.coin, duration: query.duration, direction: query.direction },
            summary: this.summarize(bets),
            bets: rows,
          },
          null,
          2,
        ),
      };
    }

    if (format === 'pdf') {
      return {
        filename: `${filename}.pdf`,
        contentType: 'application/pdf',
        body: await this.renderPdf(username, from, to, query, bets, rows),
      };
    }

    const header = Object.keys(rows[0] ?? {
      id: 0, createdAt: 0, coin: 0, direction: 0, durationSeconds: 0, amount: 0,
      entryPrice: 0, exitPrice: 0, status: 0, payout: 0, profit: 0, resolvedAt: 0,
    });
    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    return {
      filename: `${filename}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: [header.join(','), ...rows.map((row) => header.map((key) => escape(row[key])).join(','))].join('\n'),
    };
  }

  private renderPdf(
    username: string,
    from: Date,
    to: Date,
    query: AnalyticsQueryDto,
    bets: BetRow[],
    rows: { [key: string]: unknown }[],
  ): Promise<Buffer> {
    const summary = this.summarize(bets);
    const byCoin = breakdown(bets, (bet) => bet.coin);
    const MAX_ROWS = 400;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: { Title: 'Transcendence trading report', Author: 'Transcendence' },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const bottom = () => doc.page.height - doc.page.margins.bottom;

      const table = (columns: { label: string; width: number }[], data: string[][]) => {
        const drawRow = (cells: string[], bold: boolean) => {
          if (doc.y + 16 > bottom()) doc.addPage();
          const y = doc.y;
          let x = left;
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
          cells.forEach((cell, i) => {
            doc.text(cell, x, y, { width: columns[i].width - 4, lineBreak: false, ellipsis: true });
            x += columns[i].width;
          });
          doc.y = y + 14;
        };

        drawRow(columns.map((c) => c.label), true);
        data.forEach((cells) => drawRow(cells, false));
        doc.x = left;
      };

      doc.font('Helvetica-Bold').fontSize(18).text('Transcendence - Trading report');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor('#444444')
        .text(`Player: ${username}`)
        .text(`Period: ${dayKey(from)} to ${dayKey(to)} (UTC)`)
        .text(
          `Filters: coin ${query.coin ?? 'all'}, duration ${query.duration ? `${query.duration / 60} min` : 'all'}, direction ${query.direction ?? 'all'}`,
        )
        .text(`Generated: ${new Date().toISOString()}`);
      doc.fillColor('#000000').moveDown();

      doc.font('Helvetica-Bold').fontSize(12).text('Summary');
      doc.moveDown(0.3);
      table(
        [{ label: 'Metric', width: 200 }, { label: 'Value', width: 200 }],
        [
          ['Bets placed', String(summary.bets)],
          ['Won / Lost / Refunded / Open', `${summary.won} / ${summary.lost} / ${summary.refunded} / ${summary.pending}`],
          ['Win rate', percent(summary.winRate)],
          ['Total staked', tdollars(summary.wagered)],
          ['Net profit', tdollars(summary.profit)],
          ['Return on stake', percent(summary.roi)],
          ['Average stake', tdollars(summary.avgStake)],
          ['Biggest win', tdollars(summary.biggestWin)],
          ['Biggest loss', tdollars(summary.biggestLoss)],
          ['Best win streak', String(summary.bestStreak)],
        ],
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').fontSize(12).text('By coin');
      doc.moveDown(0.3);
      table(
        [
          { label: 'Coin', width: 80 },
          { label: 'Bets', width: 80 },
          { label: 'Win rate', width: 100 },
          { label: 'Staked', width: 120 },
          { label: 'Profit', width: 120 },
        ],
        byCoin.map((c) => [c.key, String(c.bets), percent(c.winRate), tdollars(c.wagered), tdollars(c.profit)]),
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').fontSize(12).text('Bets');
      doc.moveDown(0.3);
      table(
        [
          { label: 'Date (UTC)', width: 100 },
          { label: 'Coin', width: 40 },
          { label: 'Side', width: 45 },
          { label: 'Time', width: 40 },
          { label: 'Stake', width: 60 },
          { label: 'Entry', width: 70 },
          { label: 'Exit', width: 70 },
          { label: 'Result', width: 60 },
          { label: 'Profit', width: 50 },
        ],
        rows.slice(0, MAX_ROWS).map((r) => [
          String(r.createdAt).slice(0, 19).replace('T', ' '),
          String(r.coin),
          String(r.direction),
          `${Number(r.durationSeconds) / 60}m`,
          String(r.amount),
          Number(r.entryPrice).toFixed(2),
          r.exitPrice === null ? '-' : Number(r.exitPrice).toFixed(2),
          String(r.status),
          r.profit === null ? '-' : String(r.profit),
        ]),
      );

      if (rows.length > MAX_ROWS) {
        doc.moveDown().font('Helvetica-Oblique').fontSize(9)
          .text(`Only the first ${MAX_ROWS} of ${rows.length} bets are listed. Use the CSV export for the full list.`);
      }

      doc.end();
    });
  }
}
