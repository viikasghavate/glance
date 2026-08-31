import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import './SkillsPage.css';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const LEVEL_CLASS = {
  Beginner: 'level-beginner',
  Intermediate: 'level-intermediate',
  Advanced: 'level-advanced',
  Expert: 'level-expert'
};

export default function SkillsPage() {
  const { apiFetch, hasRole, user } = useAuth();
  const isAdmin = hasRole('admin');
  const [tab, setTab] = useState('mine');

  return (
    <div>
      <div className="page-header">
        <h1>Skills</h1>
      </div>

      <div className="view-toggle skills-tabs">
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>My Skills</button>
        <button className={tab === 'coverage' ? 'active' : ''} onClick={() => setTab('coverage')}>Team Coverage</button>
        {isAdmin && (
          <button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalog</button>
        )}
      </div>

      {tab === 'mine' && <MySkills />}
      {tab === 'coverage' && <TeamCoverage />}
      {tab === 'catalog' && isAdmin && <Catalog />}
    </div>
  );
}

function MySkills() {
  const { apiFetch, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addSkillId, setAddSkillId] = useState('');

  const load = async () => {
    try {
      const [p, c] = await Promise.all([
        apiFetch(`/skills/user/${user.id}`),
        apiFetch('/skills')
      ]);
      setProfile(p);
      setCatalog(c);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateSkill = async (skillId, level, yearsExperience) => {
    try {
      await apiFetch(`/skills/user/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ skillId, level, yearsExperience })
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeSkill = async (skillId) => {
    try {
      await apiFetch(`/skills/user/${user.id}/${skillId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const addSkill = async () => {
    if (!addSkillId) return;
    await updateSkill(Number(addSkillId), 'Intermediate', 0);
    setAddSkillId('');
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const mySkillIds = new Set((profile?.skills || []).map(s => s.skillId));
  const available = catalog.filter(s => !mySkillIds.has(s.id));

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}

      <div className="skills-add-row">
        <select value={addSkillId} onChange={e => setAddSkillId(e.target.value)}>
          <option value="">Add a skill...</option>
          {available.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.category ? ` (${s.category})` : ''}</option>
          ))}
        </select>
        <button className="btn-primary" onClick={addSkill} disabled={!addSkillId}>Add</button>
      </div>

      {!profile || profile.skills.length === 0 ? (
        <div className="empty">No skills yet. Add a skill from the catalog above.</div>
      ) : (
        <div className="members-table-wrap">
          <table className="members-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Category</th>
                <th>Level</th>
                <th>Years Experience</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profile.skills.map(s => (
                <tr key={s.skillId}>
                  <td>{s.name}</td>
                  <td>{s.category || '-'}</td>
                  <td>
                    <select
                      className="status-select"
                      value={s.level}
                      onChange={e => updateSkill(s.skillId, e.target.value, s.yearsExperience)}
                    >
                      {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={s.yearsExperience}
                      onChange={e => updateSkill(s.skillId, s.level, Number(e.target.value))}
                      style={{ maxWidth: '100px' }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => removeSkill(s.skillId)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeamCoverage() {
  const { apiFetch } = useAuth();
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [skill, setSkill] = useState('');
  const [level, setLevel] = useState('');

  useEffect(() => {
    apiFetch('/skills').then(setCatalog).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (skill) params.set('skill', skill);
      if (level) params.set('level', level);
      const qs = params.toString();
      const data = await apiFetch(`/skills/coverage${qs ? `?${qs}` : ''}`);
      setRows(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [q, skill, level]);

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}

      <div className="skills-filters">
        <input
          type="text"
          placeholder="Search by name..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ maxWidth: '240px' }}
        />
        <select value={skill} onChange={e => setSkill(e.target.value)} style={{ maxWidth: '200px' }}>
          <option value="">All Skills</option>
          {catalog.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={level} onChange={e => setLevel(e.target.value)} style={{ maxWidth: '160px' }}>
          <option value="">Any Level</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}+</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="empty">No skills match your filters.</div>
      ) : (
        <div className="members-table-wrap">
          <table className="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Skill</th>
                <th>Category</th>
                <th>Level</th>
                <th>Years</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.userId}-${r.skillId}-${i}`}>
                  <td>{r.userName}</td>
                  <td>{r.skillName}</td>
                  <td>{r.category || '-'}</td>
                  <td><span className={`level-badge ${LEVEL_CLASS[r.level] || ''}`}>{r.level}</span></td>
                  <td className="date-cell">{r.yearsExperience != null ? r.yearsExperience : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Catalog() {
  const { apiFetch } = useAuth();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    try {
      const data = await apiFetch('/skills');
      setSkills(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiFetch(`/skills/${confirmDelete.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Skill Catalog</h2>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ Add Skill</button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {skills.length === 0 ? (
        <div className="empty">No skills in the catalog yet.</div>
      ) : (
        <div className="members-table-wrap">
          <table className="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Description</th>
                <th>Users</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {skills.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.category || '-'}</td>
                  <td>{s.description || '-'}</td>
                  <td className="date-cell">{s.userCount}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn-ghost btn-sm" onClick={() => { setEditing(s); setShowModal(true); }}>Edit</button>
                      <button
                        className="btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setConfirmDelete(s)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <SkillModal
          skill={editing}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (editing) {
              await apiFetch(`/skills/${editing.id}`, { method: 'PATCH', body: JSON.stringify(data) });
            } else {
              await apiFetch('/skills', { method: 'POST', body: JSON.stringify(data) });
            }
            setShowModal(false);
            await load();
          }}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2>Delete Skill</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Are you sure you want to delete <strong>{confirmDelete.name}</strong>?
              It will be removed from all users.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillModal({ skill, onClose, onSave }) {
  const [name, setName] = useState(skill?.name || '');
  const [category, setCategory] = useState(skill?.category || '');
  const [description, setDescription] = useState(skill?.description || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await onSave({ name: name.trim(), category: category.trim(), description: description.trim() });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{skill ? 'Edit Skill' : 'Add Skill'}</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="skname">Name</label>
            <input id="skname" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="skcat">Category</label>
            <input id="skcat" type="text" value={category} onChange={e => setCategory(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="skdesc">Description</label>
            <textarea id="skdesc" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : skill ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
