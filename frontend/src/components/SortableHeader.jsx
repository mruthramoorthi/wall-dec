// Shared clickable <th> used by list screen table headers. Clicking
// toggles asc/desc; clicking a different column starts it at ascending.
export default function SortableHeader({ label, sortKey, currentSort, currentDir, onSort, disabled = false, className = '', align = '' }) {
  const isActive = currentSort === sortKey;
  const nextDir = isActive && currentDir === 'asc' ? 'desc' : 'asc';
  const isRight = align === 'right' || className.includes('num-cell');
  return (
    <th
      className={`sortable-th ${className} ${isRight ? 'num-cell' : ''} ${disabled ? 'sortable-disabled' : ''}`}
      onClick={() => !disabled && onSort(sortKey, nextDir)}
      style={{
        cursor: disabled ? 'wait' : 'pointer',
        userSelect: 'none',
        ...(isRight ? { textAlign: 'right' } : {}),
        ...(disabled ? { opacity: 0.7 } : {})
      }}
    >
      {label} {isActive ? (currentDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}
