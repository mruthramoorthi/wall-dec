import { useState, useRef, useEffect } from 'react';

/**
 * Enhanced SearchableSelect Component
 * 
 * Props:
 * - options: Array<string | { value: any, label: string, sublabel?: string, disabled?: boolean }>
 * - value: any (current selected value or label)
 * - onChange: (value: any, optionObj?: object) => void
 * - placeholder: string (e.g. "-- Select Option --")
 * - allowCustom: boolean (default false - if true, allows typing new custom values)
 * - disabled: boolean
 * - required: boolean
 * - style: object
 * - className: string
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = '-- Select option --',
  allowCustom = false,
  disabled = false,
  required = false,
  style = {},
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options into uniform { value, label, sublabel, disabled } shape
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value : (opt.uid || opt.id || opt.code || opt.mode_code || opt.category_name || opt.dealer_name || opt.bank_name || opt.label),
        label: opt.label || opt.name || opt.category_name || opt.mode_name || opt.dealer_name || opt.bank_name || opt.size_name || String(opt.value || ''),
        sublabel: opt.sublabel || opt.bank_code || opt.account_number || '',
        disabled: Boolean(opt.disabled)
      };
    }
    return {
      value: opt,
      label: String(opt),
      sublabel: '',
      disabled: false
    };
  });

  // Filter options based on user search query
  const filtered = normalizedOptions.filter((opt) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      String(opt.value).toLowerCase().includes(q)
    );
  });

  // If allowCustom and user typed something not matching any option
  const showCustomOption = allowCustom && search.trim() && !normalizedOptions.some(
    o => o.label.toLowerCase() === search.trim().toLowerCase() || String(o.value).toLowerCase() === search.trim().toLowerCase()
  );

  const allChoices = showCustomOption
    ? [{ value: search.trim(), label: search.trim(), isCustom: true, sublabel: '' }, ...filtered]
    : filtered;

  // Selected item object
  const selectedOption = normalizedOptions.find((o) => o.value === value || o.label === value);
  const displayLabel = selectedOption ? selectedOption.label : (value || '');

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      const initIdx = value
        ? allChoices.findIndex((o) => o.value === value || o.label === value)
        : 0;
      setHighlightIndex(initIdx >= 0 ? initIdx : 0);
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    }
  }, [isOpen]); // eslint-disable-line

  // Automatically scroll highlighted item into view on keyboard navigation
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const listEl = listRef.current;
    const itemEl = listEl.children[highlightIndex];
    if (itemEl && typeof itemEl.scrollIntoView === 'function') {
      itemEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selectOption = (opt) => {
    if (opt.disabled) return;
    if (onChange) {
      onChange(opt.value, opt);
    }
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1 < allChoices.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allChoices.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allChoices.length > 0 && allChoices[highlightIndex]) {
        selectOption(allChoices[highlightIndex]);
      } else if (allowCustom && search.trim()) {
        selectOption({ value: search.trim(), label: search.trim() });
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`searchable-select-container ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
      onKeyDown={handleKeyDown}
    >
      {/* Closed Display Trigger Button */}
      <div
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          background: disabled ? '#f1f5f9' : '#ffffff',
          border: isOpen ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem',
          color: displayLabel ? '#0f172a' : '#94a3b8',
          userSelect: 'none',
          boxShadow: isOpen ? '0 0 0 2px rgba(37,99,235,0.15)' : 'none',
          opacity: disabled ? 0.7 : 1,
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
        }}
      >
        <span style={{ fontWeight: displayLabel ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel || placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
            marginLeft: '0.5rem'
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          tabIndex={-1}
          value={value || ''}
          required={required}
          onChange={() => {}}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            height: 0,
            width: 0,
            bottom: 0,
            left: '50%'
          }}
        />
      )}

      {/* Dropdown Popup */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}
        >
          {/* Top Search Input */}
          <div style={{ padding: '0.45rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search or type custom…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(0);
              }}
              style={{
                width: '100%',
                padding: '0.4rem 0.65rem',
                border: '1px solid #cbd5e1',
                borderRadius: 5,
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fff'
              }}
            />
          </div>

          {/* Options List */}
          <ul
            ref={listRef}
            style={{
              listStyle: 'none',
              margin: 0,
              padding: '0.25rem 0',
              maxHeight: 220,
              overflowY: 'auto',
              fontSize: '0.88rem',
              scrollBehavior: 'smooth'
            }}
          >
            {allChoices.map((opt, idx) => {
              const isHighlighted = idx === highlightIndex;
              const isSelected = opt.value === value || opt.label === value;
              const isCustom = opt.isCustom;

              return (
                <li
                  key={`${opt.value}-${idx}`}
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    background: isHighlighted ? '#eff6ff' : isSelected ? '#f8fafc' : 'transparent',
                    color: opt.disabled ? '#94a3b8' : isHighlighted ? '#1d4ed8' : '#1e293b',
                    fontWeight: isSelected ? 700 : isHighlighted ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: opt.disabled ? 0.6 : 1
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>
                      {isCustom && <span style={{ color: '#2563eb', fontWeight: 700, marginRight: 4 }}>+ Use:</span>}
                      {opt.label}
                    </span>
                    {opt.sublabel && (
                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span style={{ color: '#16a34a', fontSize: '0.9rem', fontWeight: 900, marginLeft: '0.5rem' }}>
                      ✓
                    </span>
                  )}
                </li>
              );
            })}

            {allChoices.length === 0 && (
              <li style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No matches found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
