// Shared clickable <th> used by list screen table headers. Clicking
// toggles asc/desc; clicking a different column starts it at ascending.
export default function SortableHeader({ label, sortKey, currentSort, currentDir, onSort, disabled = false }) {
  const isActive = currentSort === sortKey;
  const nextDir = isActive && currentDir === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className={`sortable-th ${disabled ? 'sortable-disabled' : ''}`}
      onClick={() => !disabled && onSort(sortKey, nextDir)}
      style={disabled ? { cursor: 'wait', opacity: 0.7 } : { cursor: 'pointer', userSelect: 'none' }}
    >
      {label} {isActive ? (currentDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}
