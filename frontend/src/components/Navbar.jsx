import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import ProfileDropdown from './ProfileDropdown';
import ConnectionBadge from './ConnectionBadge';
import { useApp, useSocketEvent } from '../context/AppContext';
import { getFriends } from '../api/friends';

// Links depend on the role: guests see the public pages, logged-in users
// their dashboards, moderators and admins their tools.
function navLinks(user, pendingRequests) {
  const links = [
    { to: '/', label: 'Trade', end: true },
    { to: '/leaderboard', label: 'Leaderboard' },
  ];
  if (user) {
    links.push(
      { to: '/friends', label: 'Friends', badge: pendingRequests },
      { to: '/rewards', label: 'Rewards' },
      { to: '/dashboard', label: 'Dashboard' },
    );
  }
  if (user?.role === 'MODERATOR' || user?.role === 'ADMIN') {
    links.push({ to: '/moderation', label: 'Moderation' });
  }
  if (user?.role === 'ADMIN') {
    links.push({ to: '/admin', label: 'Admin' });
  }
  return links;
}

const linkClass = ({ isActive }) =>
  `rounded px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] no-underline transition-colors ${
    isActive ? 'bg-panel-2 text-accent' : 'text-dim hover:text-accent'
  }`;

export default function Navbar({ onRegisterClick, onLoginClick, onSettingsClick, onForumClick }) {
  const { user, logout } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const [pendingRequests, setPendingRequests] = useState(0);
  const userId = user?.id;

  // Close the mobile menu after navigating.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Number of friend requests waiting for an answer (badge on "Friends").
  const loadRequests = useCallback(() => {
    if (!userId) {
      setPendingRequests(0);
      return;
    }
    getFriends()
      .then((data) => setPendingRequests(data.incoming.length))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useSocketEvent('friends:update', loadRequests);

  const links = navLinks(user, pendingRequests);

  const renderLink = (link) => (
    <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
      {link.label}
      {link.badge > 0 && (
        <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] text-bg" aria-label={`${link.badge} pending`}>
          {link.badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <header className="no-print border-b border-line bg-bg">
      <nav className="navbar" aria-label="Main">
        <div className="flex items-center gap-4">
          <NavLink to="/" className="logo no-underline" title="Home">
            <span className="logo-text">Transcendence</span>
            <span className="logo-tag">Beta</span>
          </NavLink>

          <div className="hidden items-center gap-1 lg:flex">{links.map(renderLink)}</div>
        </div>

        <div className="nav-actions">
          <ConnectionBadge />

          <div className="nav-icons">
            {user && (
              <button className="nav-icon-btn" aria-label="Forum" title="Forum" onClick={onForumClick}>
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </button>
            )}
            {user && (
              <button className="nav-icon-btn" aria-label="Settings" title="Settings" onClick={onSettingsClick}>
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}
          </div>

          {user && (
            <>
              <div className="nav-divider" />
              <div className="nav-balance" aria-live="polite">
                <span className="nav-balance-label">Balance</span>
                <span className="nav-balance-value">
                  {(user.wallet ?? 0).toLocaleString('en-US')} T$
                </span>
              </div>
            </>
          )}

          <div className="nav-divider" />

          {user ? (
            <ProfileDropdown user={user} onLogout={() => logout('You are logged out.')} onSettingsClick={onSettingsClick} />
          ) : (
            <div className="flex gap-2">
              <button className="nav-btn nav-btn--ghost" onClick={onLoginClick}>Login</button>
              <button className="nav-btn nav-btn--solid" onClick={onRegisterClick}>Register</button>
            </div>
          )}

          <button
            type="button"
            className="nav-icon-btn lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="flex flex-col gap-1 border-t border-line px-4 py-3 lg:hidden">
          {links.map(renderLink)}
        </div>
      )}
    </header>
  );
}
