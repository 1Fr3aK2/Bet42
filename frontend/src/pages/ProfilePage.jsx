import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProfile } from '../api/users';
import { Avatar, Badge, Card, EmptyState, ErrorMessage, Loading, StatTile } from '../components/ui';
import { formatDateTime, formatDuration, formatPercent, formatTD } from '../utils/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Public profile of a player (reached from the leaderboard or the live feed).
export default function ProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  useDocumentTitle(profile ? profile.username : 'Player');

  useEffect(() => {
    setProfile(null);
    setError('');
    getProfile(id).then(setProfile).catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorMessage>{error}</ErrorMessage>
        <Link to="/leaderboard" className="mt-4 inline-block text-accent">← Back to the leaderboard</Link>
      </div>
    );
  }

  if (!profile) return <Loading />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar src={profile.avatarUrl} name={profile.username} size={72} />
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-widest text-text">{profile.username}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dim">
            <Badge tone="accent">Level {profile.level}</Badge>
            {profile.role !== 'USER' && <Badge>{profile.role}</Badge>}
            <span>Member since {new Date(profile.createdAt).toLocaleDateString('en-GB')}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Balance" value={formatTD(profile.wallet)} tone="accent" />
        <StatTile label="Wins / Losses" value={`${profile.wins} / ${profile.losses}`} />
        <StatTile label="Win rate" value={formatPercent(profile.winRate)} tone={profile.winRate >= 0.5 ? 'up' : 'neutral'} />
        <StatTile label="Best streak" value={profile.bestStreak} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title={`Achievements (${profile.achievements.length})`}>
          {profile.achievements.length === 0 ? (
            <EmptyState>No achievements yet.</EmptyState>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0">
              {profile.achievements.map((a) => (
                <li key={a.code} className="flex items-center gap-3 rounded border border-line p-2">
                  <span aria-hidden="true" className="text-xl">{a.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-text">{a.name}</div>
                    <div className="text-xs text-dim">{a.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent results">
          {profile.recentBets.length === 0 ? (
            <EmptyState>No settled bets yet.</EmptyState>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {profile.recentBets.map((bet) => (
                <li key={bet.id} className="flex items-center justify-between border-b border-line pb-2 text-xs last:border-0">
                  <span className="text-dim">
                    <span className="font-bold text-text">{bet.coin} {bet.direction}</span> · {formatDuration(bet.duration)} · {formatDateTime(bet.createdAt)}
                  </span>
                  <span className={bet.status === 'WON' ? 'text-up' : bet.status === 'LOST' ? 'text-down' : 'text-dim'}>
                    {bet.status === 'REFUNDED' ? 'Refund' : formatTD(bet.payout - bet.amount, { sign: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
