import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProfile } from '../api/users';
import { acceptFriendRequest, deleteFriendRequest, getRelationship, removeFriend, sendFriendRequest } from '../api/friends';
import { useApp, useSocketEvent } from '../context/AppContext';
import { Avatar, Badge, Button, Card, EmptyState, ErrorMessage, Loading, StatTile } from '../components/ui';
import OnlineDot from '../components/OnlineDot';
import { formatDateTime, formatDuration, formatPercent, formatTD } from '../utils/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Add / cancel / accept / remove, depending on the relationship.
function FriendControls({ playerId, username }) {
  const { user, notify } = useApp();
  const [relation, setRelation] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    getRelationship(playerId).then(setRelation).catch(() => setRelation(null));
  }, [user, playerId]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('friends:update', load);
  useSocketEvent('friend:presence', ({ userId, online }) => {
    if (userId === Number(playerId)) setRelation((r) => (r ? { ...r, online } : r));
  });

  if (!user || !relation || relation.status === 'self') return null;

  async function run(action, message) {
    setBusy(true);
    try {
      await action();
      notify(message, 'info');
      load();
    } catch (err) {
      notify(err.message, 'loss');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {relation.status === 'friends' && (
        <>
          <Badge tone="up">Friends</Badge>
          <OnlineDot online={relation.online} />
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => removeFriend(playerId), `${username} removed from your friends`)}>
            Remove friend
          </Button>
        </>
      )}
      {relation.status === 'none' && (
        <Button size="sm" disabled={busy} onClick={() => run(() => sendFriendRequest({ userId: Number(playerId) }), `Friend request sent to ${username}`)}>
          Add friend
        </Button>
      )}
      {relation.status === 'outgoing' && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => deleteFriendRequest(relation.requestId), 'Friend request cancelled')}>
          Cancel request
        </Button>
      )}
      {relation.status === 'incoming' && (
        <>
          <Button size="sm" disabled={busy} onClick={() => run(() => acceptFriendRequest(relation.requestId), `You are now friends with ${username}`)}>
            Accept friend request
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => deleteFriendRequest(relation.requestId), 'Friend request declined')}>
            Decline
          </Button>
        </>
      )}
    </div>
  );
}

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
        <div className="ml-auto">
          <FriendControls playerId={profile.id} username={profile.username} />
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
