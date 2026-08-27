import { useState, useEffect } from 'react';
import { listRoles, createRole, updateRole, deleteRole } from '../../api/role.js';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { Link } from 'react-router-dom';

const ROLE_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'role_name', label: 'Role Name', defaultVisible: true },
  { key: 'description', label: 'Description', defaultVisible: true },
  { key: 'employees', label: 'Assigned Staff', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true }
];

function IconEdit() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconTrash() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
}

export default function RoleMaster() {
  const [editingUid, setEditingUid] = useState(null);
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSystem, setIsSystem] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { isVisible } = useColumnVisibility('role_master_columns', ROLE_COLS);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await listRoles({ search });
      setRows(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => loadRoles(), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const resetForm = () => {
    setEditingUid(null);
    setRoleName('');
    setDescription('');
    setIsActive(true);
    setIsSystem(false);
    setError(null);
  };

  const startEdit = (r) => {
    setEditingUid(r.uid);
    setRoleName(r.role_name);
    setDescription(r.description || '');
    setIsActive(Boolean(r.is_active));
    setIsSystem(Boolean(r.is_system));
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!roleName.trim()) {
      return setError('Role name is required.');
    }

    setSaving(true);
    try {
      if (editingUid) {
        await updateRole(editingUid, {
          role_name: roleName.trim(),
          description: description.trim(),
          is_active: isActive
        });
        setSuccess(`Role "${roleName.trim()}" updated successfully!`);
      } else {
        const res = await createRole({
          role_name: roleName.trim(),
          description: description.trim()
        });
        setSuccess(`Role "${res.data.role_name}" created successfully!`);
      }
      resetForm();
      await loadRoles();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRole(deleteTarget.uid);
      if (editingUid === deleteTarget.uid) resetForm();
      setSuccess(`Role "${deleteTarget.role_name}" deleted!`);
      setDeleteTarget(null);
      await loadRoles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to delete: ${err.message}`);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <span>🔑</span> Role Master
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Create and manage custom employee roles and designations for position-based permissions
          </p>
        </div>

        <Link
          to="/screen-rights"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: '#0f172a',
            color: '#fff',
            padding: '0.55rem 1rem',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: '0.88rem',
            fontWeight: 700
          }}
        >
          <span>🛡️</span> Configure Page Rights
        </Link>
      </div>

      {editingUid && (
        <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
          <span>✏️ Editing Role: <strong>{roleName}</strong></span>
          <button type="button" onClick={resetForm} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Cancel</button>
        </div>
      )}

      {/* ── Role Form Card ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>{editingUid ? 'Edit Role Details' : 'Create New Role'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ gridTemplateColumns: '1.5fr 2.5fr 1fr', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <label>
              Role Name <span style={{ color: '#ef4444' }}>*</span>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Sales Staff, Cashier, Supervisor"
                disabled={isSystem && editingUid}
              />
              {isSystem && editingUid && (
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>System role name cannot be renamed</span>
              )}
            </label>

            <label>
              Role Description / Responsibilities
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of permissions or scope"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              Status
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: '#16a34a', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: isActive ? '#15803d' : '#94a3b8' }}>
                  {isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
            </label>
          </div>

          {error && <div className="field-error" style={{ marginBottom: '0.85rem' }}>{error}</div>}
          {success && <div className="success" style={{ marginBottom: '0.85rem' }}>✓ {success}</div>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '0.6rem 1.4rem',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving…' : editingUid ? '💾 Update Role' : '➕ Create Role'}
            </button>
            {editingUid && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '0.6rem 1rem',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Table Controls & Search ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <input
          type="text"
          placeholder="Search roles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
        />
      </div>

      {/* ── Roles Data Table ── */}
      <TableContainer loading={loading} text="Loading roles…" subtext="Fetching role master list">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 50, textAlign: 'right' }}>S.No</th>}
              {isVisible('role_name') && <th>Role Name</th>}
              {isVisible('description') && <th>Description</th>}
              {isVisible('employees') && <th style={{ textAlign: 'right', width: 130 }}>Assigned Staff</th>}
              {isVisible('status') && <th style={{ textAlign: 'center', width: 90 }}>Status</th>}
              {isVisible('actions') && <th className="actions-th" style={{ textAlign: 'center', width: 140 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.uid} style={{ opacity: r.is_active ? 1 : 0.6 }}>
                {isVisible('sno') && <td className="num-cell">{idx + 1}</td>}
                {isVisible('role_name') && (
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>
                    <span>{r.role_name}</span>
                    {r.is_system ? (
                      <span style={{ fontSize: '0.68rem', background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: 4, marginLeft: '0.45rem', fontWeight: 700 }}>
                        SYSTEM
                      </span>
                    ) : null}
                  </td>
                )}
                {isVisible('description') && (
                  <td style={{ color: '#475569', fontSize: '0.88rem' }}>
                    {r.description || '—'}
                  </td>
                )}
                {isVisible('employees') && (
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.15rem 0.6rem',
                      borderRadius: 12,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: r.employee_count > 0 ? '#eff6ff' : '#f1f5f9',
                      color: r.employee_count > 0 ? '#1d4ed8' : '#94a3b8'
                    }}>
                      👤 {r.employee_count} {r.employee_count === 1 ? 'employee' : 'employees'}
                    </span>
                  </td>
                )}
                {isVisible('status') && (
                  <td style={{ textAlign: 'center' }}>
                    {r.is_active ? (
                      <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                        Active
                      </span>
                    ) : (
                      <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecdd3', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                        Disabled
                      </span>
                    )}
                  </td>
                )}
                {isVisible('actions') && (
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="icon-btn edit-btn"
                        title="Edit Role"
                        onClick={() => startEdit(r)}
                      >
                        <IconEdit />
                      </button>
                      {!r.is_system && (
                        <button
                          type="button"
                          className="icon-btn delete-btn"
                          title={r.employee_count > 0 ? 'Cannot delete role with assigned employees' : 'Delete Role'}
                          disabled={r.employee_count > 0}
                          onClick={() => setDeleteTarget(r)}
                          style={{ opacity: r.employee_count > 0 ? 0.4 : 1 }}
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  {loading ? 'Loading roles…' : 'No roles found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <h3>Confirm Delete Role</h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0.75rem 0' }}>
              Are you sure you want to delete role <strong>"{deleteTarget.role_name}"</strong>?
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: '#dc2626' }} onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
