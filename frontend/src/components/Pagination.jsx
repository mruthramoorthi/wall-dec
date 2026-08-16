// Shared pagination control used on list screens.
export default function Pagination({ page, pageSize, total, onPageChange, loading = false }) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  if (totalPages <= 1) return null;

  return (
    <div className={`pagination ${loading ? 'pagination-disabled' : ''}`}>
      <button disabled={page <= 1 || loading} onClick={() => !loading && onPageChange(page - 1)}>Prev</button>
      <span>Page {page} of {totalPages} ({total} total)</span>
      <button disabled={page >= totalPages || loading} onClick={() => !loading && onPageChange(page + 1)}>Next</button>
    </div>
  );
}
