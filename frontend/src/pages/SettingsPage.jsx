import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './SettingsPage.css';

const THEME_KEY = 'glance_theme';

function getInitialTheme() {
  return localStorage.getItem(THEME_KEY) || 'neon';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export default function SettingsPage() {
  const { user, apiFetch, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleThemeChange = (next) => {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileSaving(true);
    try {
      const updated = await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, email })
      });
      updateUser({ name: updated.name, email: updated.email });
      setProfileSuccess('Profile updated.');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiFetch('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, password: newPassword })
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed.');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at + 'Z').toLocaleDateString()
    : '—';

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-grid">
        <section className="settings-card">
          <h2>Profile</h2>
          <div className="settings-meta">
            <div className="settings-meta-row">
              <span className="settings-meta-label">Role</span>
              <span className="badge">{user?.role}</span>
            </div>
            <div className="settings-meta-row">
              <span className="settings-meta-label">Member since</span>
              <span>{memberSince}</span>
            </div>
          </div>

          {profileError && <div className="error-msg">{profileError}</div>}
          {profileSuccess && <div className="success-msg">{profileSuccess}</div>}

          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="settings-actions">
              <button type="submit" className="btn-primary" disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card">
          <h2>Change Password</h2>
          {passwordError && <div className="error-msg">{passwordError}</div>}
          {passwordSuccess && <div className="success-msg">{passwordSuccess}</div>}

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={4}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                minLength={4}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="settings-actions">
              <button type="submit" className="btn-primary" disabled={passwordSaving}>
                {passwordSaving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card">
          <h2>Appearance</h2>
          <div className="theme-options">
            <label className={`theme-option ${theme === 'neon' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="theme"
                value="neon"
                checked={theme === 'neon'}
                onChange={() => handleThemeChange('neon')}
              />
              <span className="theme-swatch theme-swatch-neon" />
              <span className="theme-option-label">Neon</span>
            </label>
            <label className={`theme-option ${theme === 'light' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="theme"
                value="light"
                checked={theme === 'light'}
                onChange={() => handleThemeChange('light')}
              />
              <span className="theme-swatch theme-swatch-light" />
              <span className="theme-option-label">Light</span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
