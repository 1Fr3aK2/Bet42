import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { acceptFriendRequest, deleteFriendRequest, getFriends, removeFriend, sendFriendRequest } from '../api/friends';
import { useApp, useSocketEvent } from '../context/AppContext';
import { Avatar, Button, Card, EmptyState, ErrorMessage, Field, Loading, PageHeader, inputClass } from '../components/ui';
import OnlineDot from '../components/OnlineDot';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function PlayerRow({ entry, children }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <Link to={`/players/${entry.user.id}`} className="flex min-w-0 items-center gap-3 text-text no-underline hover:text-accent">
        <Avatar src={entry.user.avatarUrl} name={entry.user.username} size={36} />
        <span className="min-w-0">
          <span className="block truncate font-bold">{entry.user.username}</span>
          <span className="text-xs text-dim">Level {entry.user.level}</span>
        </span>
      </Link>
      <div className="flex items-center gap-3">{children}</div>
    </li>
  );
}

// Friends list with live online status, and friend requests.
export default function FriendsPage() {
  useDocumentTitle('Friends');
  const { notify } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    getFriends()
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('friends:update', load);

  // A friend connected or disconnected: update the dot without reloading.
  useSocketEvent('friend:presence', ({ userId, online }) => {
    setData((current) =>
      current && {
        ...current,
        friends: current.friends.map((f) => (f.user.id === userId ? { ...f, user: { ...f.user, online } } : f)),
      }
    );
  });

  async function run(action, message) {
    try {
      await action();
      if (message) notify(message, 'info');
      load();
    } catch (err) {
      notify(err.message, 'loss');
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const name = username.trim();
    if (!name) {
      setFormError('Enter a username');
      return;
    }
    if (name.length > 50) {
      setFormError('Usernames are at most 50 characters');
      return;
    }

    setFormError('');
    setSending(true);
    try {
      const result = await sendFriendRequest({ username: name });
      notify(result.status === 'friends' ? `You are now friends with ${name}` : `Friend request sent to ${name}`, 'info');
      setUsername('');
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  const online = data?.friends.filter((f) => f.user.online).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Friends" subtitle={data ? `${data.friends.length} friend(s) · ${online} online now` : undefined} />

      <Card title="Add a friend" className="mb-6">
        <form className="flex flex-wrap items-end gap-3" onSubmit={handleSend} noValidate>
          <div className="min-w-[220px] flex-1">
            <Field label="Username" error={formError}>
              {(props) => (
                <input {...props} className={inputClass} value={username} maxLength={50} autoComplete="off" onChange={(e) => setUsername(e.target.value)} />
              )}
            </Field>
          </div>
          <Button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send request'}</Button>
        </form>
      </Card>

      <ErrorMessage>{error}</ErrorMessage>

      {!data ? (
        <Loading />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title={`Friends (${data.friends.length})`} className="md:col-span-2">
            {data.friends.length === 0 ? (
              <EmptyState>No friends yet. Add players from their profile or by username.</EmptyState>
            ) : (
              <ul className="m-0 list-none p-0">
                {data.friends.map((entry) => (
                  <PlayerRow key={entry.requestId} entry={entry}>
                    <OnlineDot online={entry.user.online} />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(() => removeFriend(entry.user.id), `${entry.user.username} removed from your friends`)}
                    >
                      Remove
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Requests received (${data.incoming.length})`}>
            {data.incoming.length === 0 ? (
              <EmptyState>No pending requests.</EmptyState>
            ) : (
              <ul className="m-0 list-none p-0">
                {data.incoming.map((entry) => (
                  <PlayerRow key={entry.requestId} entry={entry}>
                    <Button size="sm" onClick={() => run(() => acceptFriendRequest(entry.requestId), `You are now friends with ${entry.user.username}`)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => run(() => deleteFriendRequest(entry.requestId))}>
                      Decline
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Requests sent (${data.outgoing.length})`}>
            {data.outgoing.length === 0 ? (
              <EmptyState>No requests waiting for an answer.</EmptyState>
            ) : (
              <ul className="m-0 list-none p-0">
                {data.outgoing.map((entry) => (
                  <PlayerRow key={entry.requestId} entry={entry}>
                    <Button size="sm" variant="secondary" onClick={() => run(() => deleteFriendRequest(entry.requestId))}>
                      Cancel
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
