import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteUserAsAdmin, getUser, listUsers, setUserRole, updateUserAsAdmin } from '../api/admin';
import { useApp } from '../context/AppContext';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  Modal,
  PageHeader,
  SegmentedControl,
  StatTile,
  inputClass,
} from '../components/ui';
import { formatDateTime, formatTD } from '../utils/format';
import { validateEmail, validateUsername } from '../utils/validation';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const ROLE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'USER', label: 'Users' },
  { value: 'MODERATOR', label: 'Moderators' },
  { value: 'ADMIN', label: 'Admins' },
];

const ROLE_TONE = { ADMIN: 'accent', MODERATOR: 'up', USER: 'neutral' };

function EditUserModal({ target, onClose, onSaved }) {
  const [form, setForm] = useState({ username: target.username, email: target.email, wallet: String(target.wallet) });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const wallet = Number(form.wallet);
    const nextErrors = {
      username: validateUsername(form.username),
      email: validateEmail(form.email),
      wallet: Number.isInteger(wallet) && wallet >= 0 && wallet <= 1e9 ? '' : 'Balance must be a whole number between 0 and 1,000,000,000',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const changes = {};
    if (form.username.trim() !== target.username) changes.username = form.username.trim();
    if (form.email.trim().toLowerCase() !== target.email) changes.email = form.email.trim().toLowerCase();
    if (wallet !== target.wallet) changes.wallet = wallet;
    if (!Object.keys(changes).length) {
      onClose();
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updateUserAsAdmin(target.id, changes);
      onSaved(`${changes.username ?? target.username} updated`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${target.username}`} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Field label="Username" error={errors.username}>
          {(props) => <input {...props} className={inputClass} value={form.username} onChange={set('username')} maxLength={20} />}
        </Field>
        <Field label="Email" error={errors.email}>
          {(props) => <input {...props} type="email" className={inputClass} value={form.email} onChange={set('email')} maxLength={254} />}
        </Field>
        <Field label="Balance (T$)" error={errors.wallet} hint="The difference is recorded in the wallet history as an admin adjustment">
          {(props) => <input {...props} type="number" min="0" step="1" className={inputClass} value={form.wallet} onChange={set('wallet')} />}
        </Field>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteUserModal({ target, onClose, onDeleted }) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    if (confirm !== target.username) {
      setError('Type the username exactly to confirm');
      return;
    }
    setDeleting(true);
    try {
      await deleteUserAsAdmin(target.id);
      onDeleted(`${target.username} deleted`);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <Modal title="Delete user" onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={handleDelete}>
        <p className="m-0 text-sm text-dim">
          This permanently deletes <strong className="text-text">{target.username}</strong> with their bets, wallet history,
          achievements, forum posts and comments. It cannot be undone.
        </p>
        <Field label={`Type "${target.username}" to confirm`}>
          {(props) => <input {...props} className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}
        </Field>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={deleting || confirm !== target.username}>
            {deleting ? 'Deleting…' : 'Delete user'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function UserDetailsModal({ userId, onClose }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getUser(userId).then(setDetails).catch((err) => setError(err.message));
  }, [userId]);

  return (
    <Modal title="User details" onClose={onClose} wide>
      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : !details ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar src={details.avatarUrl} name={details.username} size={48} />
            <div>
              <div className="font-bold text-text">{details.username}</div>
              <div className="text-xs text-dim">{details.email} · joined {formatDateTime(details.createdAt)}</div>
            </div>
            <Badge tone={ROLE_TONE[details.role]} className="ml-auto">{details.role}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Balance" value={formatTD(details.wallet)} tone="accent" />
            <StatTile label="Level" value={details.level} hint={`${details.xp} XP`} />
            <StatTile label="Bets" value={details._count.bets} hint={`${details.wins} W / ${details.losses} L`} />
            <StatTile label="Forum" value={details._count.posts} hint={`${details._count.comments} comments`} />
          </div>
          <div>
            <h3 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-dim">Latest bets</h3>
            {details.recentBets.length === 0 ? (
              <EmptyState>No bets.</EmptyState>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs">
                {details.recentBets.map((bet) => (
                  <li key={bet.id} className="flex justify-between border-b border-line pb-1 last:border-0">
                    <span className="text-dim">{formatDateTime(bet.createdAt)} · {bet.coin} {bet.direction} · {formatTD(bet.amount)}</span>
                    <span className="text-text">{bet.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link to={`/players/${details.id}`} className="text-sm text-accent">Open public profile →</Link>
        </div>
      )}
    </Modal>
  );
}

// Advanced permissions: only ADMIN can open this page (and the API checks it too).
export default function AdminPage() {
  useDocumentTitle('Admin');
  const { user, notify } = useApp();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(() => {
    listUsers({ search: search.trim() || undefined, role: role || undefined })
      .then((list) => {
        setUsers(list);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [search, role]);

  // Small delay so typing in the search box does not send a request per key.
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  async function handleRoleChange(target, newRole) {
    try {
      await setUserRole(target.id, newRole);
      notify(`${target.username} is now ${newRole}`, 'info');
      load();
    } catch (err) {
      notify(err.message, 'loss');
    }
  }

  function afterChange(message) {
    setEditing(null);
    setDeleting(null);
    notify(message, 'info');
    load();
  }

  const counts = users
    ? {
        total: users.length,
        moderators: users.filter((u) => u.role === 'MODERATOR').length,
        balance: users.reduce((sum, u) => sum + u.wallet, 0),
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="Admin" subtitle="Manage accounts, roles and balances" />

      {counts && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label="Accounts shown" value={counts.total} />
          <StatTile label="Moderators shown" value={counts.moderators} />
          <StatTile label="T$ held" value={formatTD(counts.balance)} tone="accent" />
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs uppercase tracking-wider text-dim">
            Search
            <input
              type="search"
              className={inputClass}
              placeholder="Username or email"
              value={search}
              maxLength={254}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <SegmentedControl label="Filter by role" options={ROLE_FILTERS} value={role} onChange={setRole} />
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        {!users ? (
          <Loading />
        ) : users.length === 0 ? (
          <EmptyState>No accounts match.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Accounts</caption>
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.15em] text-dim">
                  <th scope="col" className="py-2 pr-3 font-normal">User</th>
                  <th scope="col" className="hidden py-2 pr-3 font-normal md:table-cell">Email</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Role</th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">Balance</th>
                  <th scope="col" className="hidden py-2 pr-3 text-right font-normal sm:table-cell">Level</th>
                  <th scope="col" className="py-2 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  const isAdminRow = u.role === 'ADMIN';
                  return (
                    <tr key={u.id} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <Avatar src={u.avatarUrl} name={u.username} size={28} />
                          <span className="font-bold text-text">{u.username}</span>
                          {isSelf && <span className="text-[10px] uppercase text-accent">(you)</span>}
                        </div>
                      </td>
                      <td className="hidden py-2 pr-3 text-dim md:table-cell">{u.email}</td>
                      <td className="py-2 pr-3">
                        {isAdminRow ? (
                          <Badge tone="accent">Admin</Badge>
                        ) : (
                          <select
                            aria-label={`Role of ${u.username}`}
                            className="rounded border border-line-strong bg-bg px-2 py-1 font-mono text-xs text-text"
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value)}
                          >
                            <option value="USER">User</option>
                            <option value="MODERATOR">Moderator</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-accent">{formatTD(u.wallet)}</td>
                      <td className="hidden py-2 pr-3 text-right tabular-nums sm:table-cell">{u.level}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewing(u.id)} aria-label={`View ${u.username}`}>View</Button>
                          <Button size="sm" variant="secondary" disabled={isAdminRow && !isSelf} onClick={() => setEditing(u)} aria-label={`Edit ${u.username}`}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" disabled={isAdminRow || isSelf} onClick={() => setDeleting(u)} aria-label={`Delete ${u.username}`}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <EditUserModal target={editing} onClose={() => setEditing(null)} onSaved={afterChange} />}
      {deleting && <DeleteUserModal target={deleting} onClose={() => setDeleting(null)} onDeleted={afterChange} />}
      {viewing && <UserDetailsModal userId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
