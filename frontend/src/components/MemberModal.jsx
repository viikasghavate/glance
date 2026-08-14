import { useState } from 'react';

export default function MemberModal({ onClose, onSave, member }) {
  const isEdit = !!member;
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(member?.role || 'member');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required'); return; }
    if (!isEdit && !email.trim()) { setError('Email is required'); return; }
    if (!isEdit && !password) { setError('Password is required'); return; }

    setSaving(true);
    try {
      await onSave({ name: name.trim(), email: email.trim(), password, role });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit Member' : 'Add Member'}</h2>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              disabled={isEdit}
            />
          </div>

          {!isEdit && (
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
          )}

          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (isEdit ? 'Save' : 'Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
