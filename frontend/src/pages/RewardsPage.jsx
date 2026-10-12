import { useCallback, useEffect, useState } from 'react';
import { claimDailyBonus, getMyProgress } from '../api/gamification';
import { useApp, useSocketEvent } from '../context/AppContext';
import { Badge, Button, Card, ErrorMessage, Loading, PageHeader, ProgressBar, StatTile } from '../components/ui';
import { formatTD } from '../utils/format';
import { useNow } from '../hooks/useNow';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function countdown(target, now) {
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// Gamification: level & XP, daily bonus, streaks and achievements.
export default function RewardsPage() {
  useDocumentTitle('Rewards');
  const { setUser, notify } = useApp();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const now = useNow(1000);

  const load = useCallback(() => {
    getMyProgress()
      .then((data) => {
        setProgress(data);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // XP and achievements change when bets are placed or settled.
  useSocketEvent('bet:settled', load);
  useSocketEvent('bet:placed', load);
  useSocketEvent('achievement:unlocked', load);

  async function handleClaim() {
    setClaiming(true);
    try {
      const result = await claimDailyBonus();
      setUser((u) => (u ? { ...u, wallet: result.wallet, xp: result.xp, level: result.level } : u));
      notify(`🎁 Daily bonus: +${result.amount} T$ and +${result.xpGained} XP (day ${result.dailyStreak})`, 'win');
      load();
    } catch (err) {
      notify(err.message, 'loss');
      load();
    } finally {
      setClaiming(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  }

  if (!progress) return <Loading />;

  const unlocked = progress.achievements.filter((a) => a.unlocked).length;
  const nextAt = progress.dailyBonus.nextAvailableAt;
  const bonusReady = progress.dailyBonus.available || (nextAt && new Date(nextAt).getTime() <= now);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title="Rewards" subtitle="Level up, keep your streaks and unlock achievements" />

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <Card title="Level" className="md:col-span-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-4xl font-bold text-accent">Level {progress.level}</div>
              <div className="mt-1 text-xs text-dim">{progress.xp.toLocaleString('en-US')} XP in total</div>
            </div>
            <div className="text-right text-xs text-dim">
              {(progress.nextLevelXp - progress.xp).toLocaleString('en-US')} XP to level {progress.level + 1}
            </div>
          </div>
          <ProgressBar className="mt-4" value={progress.progress} label={`Progress to level ${progress.level + 1}`} />
          <div className="mt-1 flex justify-between text-[10px] text-faint">
            <span>{progress.currentLevelXp} XP</span>
            <span>{progress.nextLevelXp} XP</span>
          </div>
        </Card>

        <Card title="Daily bonus">
          <p className="m-0 text-sm text-dim">
            +{progress.dailyBonus.amount} T$ and +{progress.dailyBonus.xp} XP once per day (UTC).
          </p>
          <p className="mb-4 mt-2 text-xs text-faint">Current streak: {progress.dailyBonus.streak} day(s)</p>
          {bonusReady ? (
            <Button onClick={handleClaim} disabled={claiming} className="w-full">
              {claiming ? 'Claiming…' : 'Claim bonus'}
            </Button>
          ) : (
            <p className="m-0 text-sm text-accent" aria-live="polite">Next bonus in {countdown(nextAt, now)}</p>
          )}
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Balance" value={formatTD(progress.wallet)} tone="accent" />
        <StatTile label="Wins / Losses" value={`${progress.wins} / ${progress.losses}`} />
        <StatTile label="Current streak" value={progress.currentStreak} tone={progress.currentStreak ? 'up' : 'neutral'} />
        <StatTile label="Best streak" value={progress.bestStreak} />
      </div>

      <Card title={`Achievements · ${unlocked} / ${progress.achievements.length}`} className="mb-6">
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {progress.achievements.map((a) => (
            <li
              key={a.code}
              className={`flex items-start gap-3 rounded-lg border p-3 ${a.unlocked ? 'border-accent/50 bg-accent/5' : 'border-line opacity-60'}`}
            >
              <span aria-hidden="true" className={`text-2xl ${a.unlocked ? '' : 'grayscale'}`}>{a.icon}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-text">{a.name}</span>
                  <Badge tone={a.unlocked ? 'up' : 'neutral'}>{a.unlocked ? 'Unlocked' : 'Locked'}</Badge>
                </div>
                <p className="m-0 mt-1 text-xs text-dim">{a.description}</p>
                <p className="m-0 mt-1 text-[10px] text-faint">
                  +{a.xpReward} XP{a.unlockedAt ? ` · ${new Date(a.unlockedAt).toLocaleDateString('en-GB')}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="How it works">
        <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-dim">
          <li>Every bet you place gives <strong className="text-text">5 XP</strong>; every win gives <strong className="text-text">15 XP</strong> more.</li>
          <li>Going from level N to N+1 costs <strong className="text-text">N × 100 XP</strong> (level 2 at 100 XP, level 3 at 300 XP, level 5 at 1,000 XP).</li>
          <li>Achievements give extra XP the first time you unlock them.</li>
          <li>Win streaks count consecutive wins; a loss resets them, a refund does not.</li>
          <li>The daily bonus resets at midnight UTC. Claim it on consecutive days to grow your streak.</li>
          <li>Rewards are stored on the server and shown on your public profile and on the leaderboard.</li>
        </ul>
      </Card>
    </div>
  );
}
