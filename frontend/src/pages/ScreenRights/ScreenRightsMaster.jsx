import { useState, useEffect } from 'react';
import {
  getPermissionsMatrix,
  savePermissionsMatrix
} from '../../api/screen.js';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

export default function ScreenRightsMaster({ onPermissionsUpdated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screens, setScreens] = useState([]);
  const [roles, setRoles] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPermissionsMatrix();
      const data = res.data || {};
      setScreens(data.screens || []);
      setRoles(data.roles || []);
      setMatrix(data.matrix || {});
    } catch (err) {
      setError(err.message || 'Failed to load screen rights data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCellToggle = (role, screenKey) => {
    if (role === 'Admin') return; // Admin always has full access
    setMatrix((prev) => {
      const rolePerms = { ...(prev[role] || {}) };
      rolePerms[screenKey] = !rolePerms[screenKey];
      return {
        ...prev,
        [role]: rolePerms
      };
    });
  };

  const handleSelectAllRole = (role, selectAll = true) => {
    if (role === 'Admin') return;
    setMatrix((prev) => {
      const rolePerms = { ...(prev[role] || {}) };
      screens.forEach((s) => {
        rolePerms[s.screen_key] = selectAll;
      });
      return {
        ...prev,
        [role]: rolePerms
      };
    });
  };

  const handleSaveMatrix = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await savePermissionsMatrix(matrix);
      if (res?.data) {
        setMatrix(res.data.matrix || matrix);
      }
      setSuccess('✓ Screen permissions matrix saved successfully!');
      if (onPermissionsUpdated) {
        onPermissionsUpdated();
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const filteredScreens = screens.filter((s) =>
    (s.screen_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.screen_key || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page">
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <span>🛡️</span> Screen Rights & Role Permissions
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Configure database-driven page visibility and employee position rights across all ERP screens
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '0.5rem 0.9rem',
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={handleSaveMatrix}
            disabled={saving || loading}
            style={{
              padding: '0.55rem 1.25rem',
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
            }}
          >
            {saving ? 'Saving…' : '💾 Save Page Rights'}
          </button>
        </div>
      </div>

      {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem', fontWeight: 600, fontSize: '0.9rem' }}>
          {success}
        </div>
      )}

      {/* ── Search Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ width: '300px' }}>
          <input
            type="text"
            placeholder="Search screens by name/category…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* ── Role Rights Matrix ── */}
      <TableContainer loading={loading} text="Loading permissions matrix…" subtext="Fetching role screen rights">
        <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#fff' }}>
              <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', minWidth: '180px' }}>Screen Name</th>
              <th style={{ padding: '0.65rem 0.6rem', textAlign: 'left', width: '100px' }}>Category</th>
              <th style={{ padding: '0.65rem 0.6rem', textAlign: 'center', width: '85px' }}>Active</th>
              {roles.map((role) => (
                <th key={role} style={{ padding: '0.65rem 0.6rem', textAlign: 'center', minWidth: '110px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    <span style={{ fontWeight: 700 }}>{role}</span>
                    {role !== 'Admin' && (
                      <div style={{ display: 'flex', gap: '4px', fontSize: '0.68rem' }}>
                        <button
                          type="button"
                          onClick={() => handleSelectAllRole(role, true)}
                          style={{ background: '#334155', color: '#93c5fd', border: 'none', padding: '1px 5px', borderRadius: 3, cursor: 'pointer' }}
                          title="Select all screens for this role"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAllRole(role, false)}
                          style={{ background: '#334155', color: '#fca5a5', border: 'none', padding: '1px 5px', borderRadius: 3, cursor: 'pointer' }}
                          title="Clear all screens for this role"
                        >
                          None
                        </button>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredScreens.map((s) => {
              const isGloballyActive = Boolean(s.is_active);
              return (
                <tr
                  key={s.screen_key}
                  style={{
                    opacity: isGloballyActive ? 1 : 0.55,
                    background: isGloballyActive ? '#fff' : '#f8fafc'
                  }}
                >
                  <td style={{ padding: '0.55rem 0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.15rem' }}>{s.icon}</span>
                      <div>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{s.screen_name}</span>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>{s.route_path}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.55rem 0.6rem' }}>
                    <span style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '0.15rem 0.45rem',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {s.category}
                    </span>
                  </td>
                  <td style={{ padding: '0.55rem 0.6rem', textAlign: 'center' }}>
                    {isGloballyActive ? (
                      <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: 700 }}>● Active</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>○ Off</span>
                    )}
                  </td>

                  {roles.map((role) => {
                    const isAdmin = role === 'Admin';
                    const isChecked = isAdmin ? true : Boolean(matrix[role]?.[s.screen_key]);

                    return (
                      <td
                        key={`${role}-${s.screen_key}`}
                        style={{
                          padding: '0.55rem 0.6rem',
                          textAlign: 'center',
                          background: isAdmin ? '#f8fafc' : isChecked ? '#f0fdf4' : 'transparent',
                          cursor: isAdmin ? 'default' : 'pointer'
                        }}
                        onClick={() => !isAdmin && handleCellToggle(role, s.screen_key)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isAdmin}
                          onChange={() => handleCellToggle(role, s.screen_key)}
                          style={{
                            width: 17,
                            height: 17,
                            cursor: isAdmin ? 'default' : 'pointer',
                            accentColor: '#16a34a'
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {filteredScreens.length === 0 && (
              <tr>
                <td colSpan={roles.length + 3} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  No screens matching filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );
}
