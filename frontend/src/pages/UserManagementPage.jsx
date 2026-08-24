import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MemberModal from '../components/MemberModal';
import './UserManagementPage.css';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function UserManagementPage() {
  const { apiFetch, hasRole, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    if (!hasRole('admin')) {
      navigate('/', { replace: true });
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiFetch('/users');
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase();
      const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const adminCount = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const updated = await apiFetch(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      });
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddMember = async (data) => {
    const newUser = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setUsers(prev => [...prev, { ...newUser, stats: { projectsOwned: 0, tasksAssigned: 0, tasksCompleted: 0, comments: 0 } }]);
  };

  const handleEditName = async (data) => {
    const body = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.email !== undefined) body.email = data.email;
    const updated = await apiFetch(`/users/${editingUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
    setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiFetch(`/users/${confirmDelete.id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!newPassword || newPassword.length < 4) {
      setResetError('Password must be at least 4 characters');
      return;
    }
    setResetSubmitting(true);
    try {
      await apiFetch(`/users/${resetUser.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword })
      });
      setResetUser(null);
      setNewPassword('');
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetSubmitting(false);
    }
  };

  const isLastAdminUser = (u) => u.role === 'admin' && adminCount <= 1;

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Members</h1>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Member</button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ maxWidth: '140px' }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="empty">{search || roleFilter !== 'all' ? 'No members match your filters.' : 'No users found.'}</div>
      ) : (
        <div className="members-table-wrap">
          <table className="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Projects</th>
                <th>Tasks</th>
                <th>Done</th>
                <th>Comments</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="status-select"
                      disabled={isLastAdminUser(u) && u.id === currentUser?.id}
                      title={isLastAdminUser(u) ? 'Cannot change role of the last admin' : ''}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="date-cell">{u.stats?.projectsOwned ?? 0}</td>
                  <td className="date-cell">{u.stats?.tasksAssigned ?? 0}</td>
                  <td className="date-cell">{u.stats?.tasksCompleted ?? 0}</td>
                  <td className="date-cell">{u.stats?.comments ?? 0}</td>
                  <td className="date-cell">{timeAgo(u.last_login_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => setEditingUser(u)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => { setResetUser(u); setNewPassword(''); setResetError(''); }}
                      >
                        Reset Password
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setConfirmDelete(u)}
                        disabled={isLastAdminUser(u)}
                        title={isLastAdminUser(u) ? 'Cannot remove the last admin' : ''}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <MemberModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddMember}
        />
      )}

      {editingUser && (
        <MemberModal
          member={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleEditName}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2>Remove Member</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Are you sure you want to remove <strong>{confirmDelete.name}</strong>?
              Their tasks and projects will be unassigned, and their comments will be deleted.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {resetUser && (
        <div className="modal-overlay" onClick={() => setResetUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2>Reset Password</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Set a new password for <strong>{resetUser.name}</strong>.
            </p>
            {resetError && <div className="error-msg">{resetError}</div>}
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={4}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setResetUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={resetSubmitting}>
                  {resetSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
