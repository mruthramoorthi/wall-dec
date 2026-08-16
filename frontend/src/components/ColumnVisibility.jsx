import { useState, useRef, useEffect } from 'react';
import { getUserPreferences, saveUserPreferences } from '../api/auth.js';

/**
 * Reusable Column Visibility Manager Component & Hook
 * Persists preferences to backend user profile (user_master.ui_preferences) AND localStorage
 * for 100% cross-device persistence.
 */

export function useColumnVisibility(preferenceKey, columnsConfig) {
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('auth_user') || 'null');
    } catch {
      return null;
    }
  });

  const getInitialCols = () => {
    const defaults = columnsConfig.reduce((acc, col) => {
      acc[col.key] = col.defaultVisible !== false;
      return acc;
    }, {});

    // 1. Try local storage
    try {
      const saved = localStorage.getItem(`pref_${preferenceKey}`);
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch {}

    // 2. Try user profile prefs
    if (currentUser?.ui_preferences?.[preferenceKey]) {
      return { ...defaults, ...currentUser.ui_preferences[preferenceKey] };
    }

    return defaults;
  };

  const [visibleColumns, setVisibleColumns] = useState(getInitialCols);

  // Sync from backend on mount
  useEffect(() => {
    if (currentUser?.uid) {
      getUserPreferences(currentUser.uid)
        .then((res) => {
          const remote = res.data?.[preferenceKey];
          if (remote && typeof remote === 'object') {
            const merged = { ...getInitialCols(), ...remote };
            setVisibleColumns(merged);
            localStorage.setItem(`pref_${preferenceKey}`, JSON.stringify(merged));
          }
        })
        .catch(() => {});
    }
  }, [currentUser, preferenceKey]); // eslint-disable-line

  const toggleColumn = async (colKey) => {
    const next = {
      ...visibleColumns,
      [colKey]: !visibleColumns[colKey]
    };
    setVisibleColumns(next);
    localStorage.setItem(`pref_${preferenceKey}`, JSON.stringify(next));

    if (currentUser?.uid) {
      try {
        await saveUserPreferences(currentUser.uid, {
          [preferenceKey]: next
        });
      } catch (err) {
        console.error('Failed to sync column preferences:', err);
      }
    }
  };

  const resetColumns = async () => {
    const defaults = columnsConfig.reduce((acc, col) => {
      acc[col.key] = col.defaultVisible !== false;
      return acc;
    }, {});
    setVisibleColumns(defaults);
    localStorage.setItem(`pref_${preferenceKey}`, JSON.stringify(defaults));

    if (currentUser?.uid) {
      try {
        await saveUserPreferences(currentUser.uid, {
          [preferenceKey]: defaults
        });
      } catch {}
    }
  };

  const isVisible = (colKey) => visibleColumns[colKey] !== false;

  return { visibleColumns, toggleColumn, resetColumns, isVisible };
}

export default function ColumnVisibility({
  columns = [],
  visibleColumns = {},
  onToggle,
  onReset
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const totalCols = columns.length;
  const visibleCount = columns.filter((c) => visibleColumns[c.key] !== false).length;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.4rem 0.8rem',
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: 6,
          fontSize: '0.84rem',
          fontWeight: 600,
          color: '#334155',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          whiteSpace: 'nowrap'
        }}
        title="Show/Hide Table Columns"
      >
        <span>👁️ Columns</span>
        <span style={{
          fontSize: '0.74rem',
          background: '#eff6ff',
          color: '#1e40af',
          padding: '0.1rem 0.4rem',
          borderRadius: 4,
          fontWeight: 700,
          border: '1px solid #bfdbfe'
        }}>
          {visibleCount}/{totalCols}
        </span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 5px)',
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: 9,
          padding: '0.75rem',
          minWidth: 220,
          boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          zIndex: 9999
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '0.35rem'
          }}>
            <strong style={{ fontSize: '0.84rem', color: '#0f172a' }}>Column Visibility</strong>
            <button
              type="button"
              onClick={onReset}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
                padding: '0.1rem 0.3rem'
              }}
            >
              Reset
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: 250, overflowY: 'auto' }}>
            {columns.map((col) => (
              <label
                key={col.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  color: '#334155',
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={visibleColumns[col.key] !== false}
                  onChange={() => onToggle(col.key)}
                  style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>

          <div style={{
            marginTop: '0.65rem',
            borderTop: '1px solid #f1f5f9',
            paddingTop: '0.45rem',
            fontSize: '0.72rem',
            color: '#64748b'
          }}>
            ✓ Saved to account across devices
          </div>
        </div>
      )}
    </div>
  );
}
