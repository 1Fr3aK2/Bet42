import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function ProfileDropdown({ user, onLogout, onSettingsClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="profile-dropdown" ref={ref}>
      <button
        className="profile-avatar-btn"
        aria-label={`Account menu for ${user.username}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <img src={user.avatarUrl} alt="" />
      </button>

      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-username">
            {user.username}
            <span className="mt-1 block text-[10px] tracking-wider text-accent">
              Level {user.level ?? 1} · {user.role}
            </span>
          </div>
          <Link role="menuitem" className="profile-menu-item block no-underline" to={`/players/${user.id}`} onClick={() => setOpen(false)}>
            My profile
          </Link>
          <Link role="menuitem" className="profile-menu-item block no-underline" to="/rewards" onClick={() => setOpen(false)}>
            Rewards
          </Link>
          <button
            role="menuitem"
            className="profile-menu-item"
            onClick={() => {
              setOpen(false);
              onSettingsClick();
            }}
          >
            Settings
          </button>
          <button
            role="menuitem"
            className="profile-menu-item profile-menu-item--danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
