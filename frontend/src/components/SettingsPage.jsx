import { useEffect, useRef, useState } from 'react';
import { updateUser, changePassword, deleteAccount } from '../api/users';
import { useApp } from '../context/AppContext';
import { validateAvatarFile, validatePassword, validateUsername } from '../utils/validation';

// Crops the picture to a square and scales it to 256 px, so the uploaded
// avatar stays small (a few KB) whatever the original size.
async function resizeAvatar(file, size = 256) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(size, side);
  canvas.height = canvas.width;
  canvas
    .getContext('2d')
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const webp = canvas.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
}

export default function SettingsPage({ onClose }) {
  const [tab, setTab] = useState('profile');
  const closeRef = useRef(null);

  // Escape closes the settings, focus starts on the close button.
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="settings-page" role="dialog" aria-modal="true" aria-label="Settings">
      <button ref={closeRef} className="settings-close" aria-label="Close settings" onClick={onClose}>×</button>

      <aside className="settings-sidebar">
        <div className="settings-sidebar-header">Account</div>
        <button
          className={`settings-tab ${tab === 'profile' ? 'active' : ''}`}
          aria-pressed={tab === 'profile'}
          onClick={() => setTab('profile')}
        >
          Profile
        </button>
        <button
          className={`settings-tab ${tab === 'security' ? 'active' : ''}`}
          aria-pressed={tab === 'security'}
          onClick={() => setTab('security')}
        >
          Security
        </button>
      </aside>

      <section className="settings-content">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'security' && <SecurityTab onDeleted={onClose} />}
      </section>
    </div>
  );
}

function ProfileTab() {
  const { user, setUser, notify } = useApp();
  const [username, setUsername] = useState(user?.username || '');
  // undefined = unchanged, null = remove the picture, string = new picture
  const [avatar, setAvatar] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const preview = avatar === undefined ? user?.avatarUrl : avatar;

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const fileError = validateAvatarFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    try {
      setAvatar(await resizeAvatar(file));
      setError('');
    } catch {
      setError('This image could not be read');
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');

    const nameError = validateUsername(username);
    setUsernameError(nameError);
    if (nameError) return;

    setSaving(true);
    try {
      const updated = await updateUser({ username: username.trim(), avatar });
      setUser(updated);
      setAvatar(undefined);
      notify('Profile updated', 'win');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={handleSave} noValidate>
      <h2>Profile</h2>

      <div className="settings-avatar-row">
        <div className="settings-avatar-preview">
          {preview ? <img src={preview} alt="Avatar preview" /> : username.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex flex-col gap-2">
          <label className="settings-avatar-upload">
            Change picture
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarChange} hidden />
          </label>
          {user?.avatar && avatar !== null && (
            <button type="button" className="forum-link-btn forum-link-btn--danger text-left" onClick={() => setAvatar(null)}>
              Remove picture
            </button>
          )}
          <span className="text-xs text-faint">PNG, JPEG, WebP or GIF, up to 5 MB. Resized to 256×256.</span>
        </div>
      </div>

      <label className="settings-field">
        Username
        <input
          type="text"
          value={username}
          maxLength={20}
          aria-invalid={Boolean(usernameError)}
          aria-describedby="username-help"
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <span id="username-help" className={`text-xs ${usernameError ? 'text-down' : 'text-faint'}`}>
          {usernameError || '3-20 characters: letters, numbers or _'}
        </span>
      </label>

      <label className="settings-field">
        Email
        <input type="email" value={user?.email || ''} disabled readOnly />
      </label>

      {error && <div className="modal-error" role="alert">{error}</div>}

      <button type="submit" className="settings-save-btn" disabled={saving}>
        {saving ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}

function SecurityTab({ onDeleted }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!form.currentPassword) {
      setError('Enter your current password');
      return;
    }
    const passwordError = validatePassword(form.newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await changePassword(form);
      setSuccess(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <form className="settings-form" onSubmit={handleSave} noValidate>
        <h2>Security</h2>

        <label className="settings-field">
          Current password
          <input type="password" name="currentPassword" autoComplete="current-password" value={form.currentPassword} onChange={handleChange} required />
        </label>
        <label className="settings-field">
          New password
          <input type="password" name="newPassword" autoComplete="new-password" value={form.newPassword} onChange={handleChange} required minLength={8} maxLength={72} />
          <span className="text-xs text-faint">8-72 characters with at least one letter and one number</span>
        </label>
        <label className="settings-field">
          Confirm new password
          <input type="password" name="confirmPassword" autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} required minLength={8} maxLength={72} />
        </label>

        {error && <div className="modal-error" role="alert">{error}</div>}
        {success && <div className="settings-success" role="status">Password updated</div>}

        <button type="submit" className="settings-save-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      <DeleteAccountForm onDeleted={onDeleted} />
    </div>
  );
}

// GDPR "right to erasure": deletes the account and every related record.
function DeleteAccountForm({ onDeleted }) {
  const { user, logout } = useApp();
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (user?.role === 'ADMIN') {
    return (
      <div className="settings-form">
        <h2>Delete account</h2>
        <p className="m-0 text-sm text-dim">The administrator account cannot be deleted from the website.</p>
      </div>
    );
  }

  async function handleDelete(e) {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Enter your password to confirm');
      return;
    }
    if (!confirmed) {
      setError('Tick the box to confirm');
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount(password);
      onDeleted();
      logout('Your account and all its data have been deleted.');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={handleDelete} noValidate>
      <h2 className="!text-down">Delete account</h2>
      <p className="m-0 text-sm text-dim">
        Permanently deletes your account, bets, wallet history, achievements, forum posts and comments. This cannot be undone.
      </p>
      <label className="settings-field">
        Password
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm text-dim">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I understand that my data will be deleted permanently
      </label>
      {error && <div className="modal-error" role="alert">{error}</div>}
      <button type="submit" className="settings-save-btn !bg-down" disabled={deleting}>
        {deleting ? 'Deleting...' : 'Delete my account'}
      </button>
    </form>
  );
}
