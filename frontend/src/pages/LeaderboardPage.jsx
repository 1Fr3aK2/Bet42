import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLeaderboard } from '../api/gamification';
import { useApp, useSocketEvent } from '../context/AppContext';
import { Avatar, Card, EmptyState, ErrorMessage, Loading, PageHeader, SegmentedControl } from '../components/ui';
import { formatPercent, formatTD } from '../utils/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const SORTS = [
  { value: 'balance', label: 'Balance' },
  { value: 'xp', label: 'XP' },
  { value: 'wins', label: 'Wins' },
];

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

// Public ranking, refreshed live when bets are settled.
export default function LeaderboardPage() {
  useDocumentTitle('Leaderboard');
  const { user } = useApp();
  const [sort, setSort] = useState('balance');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getLeaderboard({ sort, limit: 50 })
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [sort]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  useSocketEvent('leaderboard:changed', load);

  const meInList = data?.me && data.entries.some((e) => e.id === data.me.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Leaderboard"
        subtitle={data ? `${data.totalPlayers} players · updates live` : 'Updates live'}
        actions={<SegmentedControl label="Sort by" options={SORTS} value={sort} onChange={setSort} />}
      />

      <ErrorMessage>{error}</ErrorMessage>

      {data?.me && !meInList && (
        <Card className="mb-4">
          <p className="m-0 text-sm text-dim">
            Your rank: <strong className="text-accent">#{data.me.rank}</strong> · {formatTD(data.me.wallet)} · level {data.me.level}
          </p>
        </Card>
      )}

      <Card>
        {!data ? (
          <Loading />
        ) : data.entries.length === 0 ? (
          <EmptyState>No players yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Players ranked by {sort}</caption>
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.15em] text-dim">
                  <th scope="col" className="py-2 pr-2 font-normal">#</th>
                  <th scope="col" className="py-2 pr-2 font-normal">Player</th>
                  <th scope="col" className="py-2 pr-2 text-right font-normal">Balance</th>
                  <th scope="col" className="py-2 pr-2 text-right font-normal">Level</th>
                  <th scope="col" className="hidden py-2 pr-2 text-right font-normal sm:table-cell">W / L</th>
                  <th scope="col" className="hidden py-2 pr-2 text-right font-normal md:table-cell">Win rate</th>
                  <th scope="col" className="hidden py-2 text-right font-normal md:table-cell">Best streak</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => {
                  const isMe = entry.id === user?.id;
                  return (
                    <tr key={entry.id} className={`border-b border-line last:border-0 ${isMe ? 'bg-accent/10' : ''}`}>
                      <td className="py-2 pr-2 font-bold text-dim">
                        {MEDALS[entry.rank] ? <span aria-label={`Rank ${entry.rank}`}>{MEDALS[entry.rank]}</span> : entry.rank}
                      </td>
                      <td className="py-2 pr-2">
                        <Link to={`/players/${entry.id}`} className="flex items-center gap-2 text-text no-underline hover:text-accent">
                          <Avatar src={entry.avatarUrl} name={entry.username} size={28} />
                          <span className="font-bold">{entry.username}</span>
                          {isMe && <span className="text-[10px] uppercase text-accent">(you)</span>}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 text-right font-bold text-accent">{formatTD(entry.wallet)}</td>
                      <td className="py-2 pr-2 text-right">{entry.level}</td>
                      <td className="hidden py-2 pr-2 text-right sm:table-cell">
                        <span className="text-up">{entry.wins}</span> / <span className="text-down">{entry.losses}</span>
                      </td>
                      <td className="hidden py-2 pr-2 text-right md:table-cell">{formatPercent(entry.winRate)}</td>
                      <td className="hidden py-2 text-right md:table-cell">{entry.bestStreak}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
