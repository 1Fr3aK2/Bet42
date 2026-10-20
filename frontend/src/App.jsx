import { useCallback, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Toasts from './components/Toast';
import RegisterModal from './components/RegisterModal';
import LoginModal from './components/LoginModal';
import SettingsPage from './components/SettingsPage';
import ForumPage from './components/Forum/ForumPage';
import RequireRole from './components/RequireRole';
import TradePage from './pages/TradePage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import RewardsPage from './pages/RewardsPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import ModerationPage from './pages/ModerationPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import TermsPage from './pages/legal/TermsPage';
import NotFoundPage from './pages/NotFoundPage';
import { useApp } from './context/AppContext';

// Layout + routes. Pages get their data from the API and the shared
// AppContext (session, live prices, notifications).
export default function App() {
  const { user, token } = useApp();
  const [modal, setModal] = useState(null); // 'login' | 'register' | null
  const [showSettings, setShowSettings] = useState(false);
  const [showForum, setShowForum] = useState(false);
  const location = useLocation();

  const openLogin = useCallback(() => setModal('login'), []);
  const closeModal = useCallback(() => setModal(null), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  // New page: start at the top (legal pages jump to their #section instead).
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  // Overlays only make sense while logged in.
  useEffect(() => {
    if (!user) {
      setShowSettings(false);
      setShowForum(false);
    }
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>

      <Navbar
        onRegisterClick={() => setModal('register')}
        onLoginClick={openLogin}
        onSettingsClick={() => setShowSettings(true)}
        onForumClick={() => setShowForum(true)}
      />

      <main id="main" className="flex-1" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<TradePage onLoginRequest={openLogin} />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/players/:id" element={<ProfilePage />} />
          <Route
            path="/friends"
            element={
              <RequireRole onLoginRequest={openLogin}>
                <FriendsPage />
              </RequireRole>
            }
          />
          <Route
            path="/rewards"
            element={
              <RequireRole onLoginRequest={openLogin}>
                <RewardsPage />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireRole onLoginRequest={openLogin}>
                <DashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="/moderation"
            element={
              <RequireRole roles={['MODERATOR', 'ADMIN']} onLoginRequest={openLogin}>
                <ModerationPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole roles={['ADMIN']} onLoginRequest={openLogin}>
                <AdminPage />
              </RequireRole>
            }
          />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
      <Toasts />

      {modal === 'register' && <RegisterModal onClose={closeModal} onSwitchToLogin={openLogin} />}
      {modal === 'login' && <LoginModal onClose={closeModal} onSwitchToRegister={() => setModal('register')} />}

      {showSettings && user && <SettingsPage onClose={closeSettings} />}

      {showForum && user && (
        <ForumPage token={token} currentUser={user} onClose={() => setShowForum(false)} />
      )}
    </div>
  );
}
