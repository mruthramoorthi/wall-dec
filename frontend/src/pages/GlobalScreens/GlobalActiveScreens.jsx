import { useState, useEffect } from 'react';
import { getAllScreens, toggleScreenActive } from '../../api/screen.js';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

export default function GlobalActiveScreens() {
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(null);
  const [togglingKey, setTogglingKey] = useState(null);

  const loadScreens = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllScreens();
      setScreens(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load screens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreens();
  }, []);

  const handleToggle = async (screenKey, currentActive) => {
    setTogglingKey(screenKey);
    setError(null);
    try {
      await toggleScreenActive(screenKey, !currentActive);
      setScreens((prev) =>
        prev.map((s) =>
          s.screen_key === screenKey ? { ...s, is_active: s.is_active ? 0 : 1 } : s
        )
      );
      setSuccess(`✓ Screen "${screenKey}" is now ${currentActive ? 'deactivated' : 'activated'} globally.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to update screen state: ${err.message}`);
    } finally {
      setTogglingKey(null);
    }
  };

  const categories = ['ALL', ...Array.from(new Set(screens.map((s) => s.category || 'Other')))];

  const filteredScreens = screens.filter((s) => {
    const matchesSearch =
      (s.screen_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.screen_key || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.route_path || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalCount = screens.length;
  const activeCount = screens.filter((s) => s.is_active === 1).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div className="page">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              🌐 Global Active Screens
            </h1>
            <span style={{
              background: '#4f46e5',
              color: '#fff',
              padding: '0.2rem 0.6rem',
              borderRadius: 20,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              Super User Only
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Global master switch: control which pages and features are enabled or deactivated across the entire ERP platform
          </p>
        </div>

        <button
          type="button"
          onClick={loadScreens}
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
          ↻ Refresh List
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total ERP Screens</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{totalCount}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Globally Active</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>{activeCount}</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, textTransform: 'uppercase' }}>Deactivated</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>{inactiveCount}</div>
        </div>
      </div>

      {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* ── Toolbar: Search & Category Filter ── */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <input
            type="text"
            placeholder="Search by screen name, key, route…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 260, flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.9rem' }}
          />

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 20,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: selectedCategory === cat ? 'none' : '1px solid #cbd5e1',
                  background: selectedCategory === cat ? '#0f172a' : '#fff',
                  color: selectedCategory === cat ? '#fff' : '#475569',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Screens Table ── */}
      <TableContainer loading={loading} text="Loading screens…" subtext="Fetching system screen master">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Screen Name</th>
              <th>Route Path</th>
              <th>Category</th>
              <th>Global Status</th>
              <th style={{ textAlign: 'center', width: 140 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredScreens.map((s, idx) => {
              const isActive = s.is_active === 1;
              const isToggling = togglingKey === s.screen_key;
              const isSelf = s.screen_key === 'global_screens';

              return (
                <tr key={s.screen_key} style={{ opacity: isActive ? 1 : 0.65, background: isActive ? '#fff' : '#f8fafc' }}>
                  <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{idx + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>{s.icon || '📄'}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>{s.screen_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>key: {s.screen_key}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.82rem', color: '#2563eb' }}>
                      {s.route_path}
                    </code>
                  </td>
                  <td>
                    <span style={{
                      background: '#f8fafc',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}>
                      {s.category || 'General'}
                    </span>
                  </td>
                  <td>
                    {isActive ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: '#dcfce7',
                        color: '#15803d',
                        padding: '0.2rem 0.6rem',
                        borderRadius: 20,
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}>
                        ● Active
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        padding: '0.2rem 0.6rem',
                        borderRadius: 20,
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}>
                        ○ Deactivated
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {isSelf ? (
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>System Core</span>
                    ) : (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggle(s.screen_key, isActive)}
                        style={{
                          padding: '0.35rem 0.8rem',
                          background: isActive ? '#fef2f2' : '#f0fdf4',
                          color: isActive ? '#dc2626' : '#16a34a',
                          border: isActive ? '1px solid #fecaca' : '1px solid #bbf7d0',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: isToggling ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isToggling ? 'Updating…' : isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredScreens.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  No screens match the search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );
}
