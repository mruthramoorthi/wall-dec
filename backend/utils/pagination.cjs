// Normalizes ?page=&pageSize=&q=&sortBy=&sortDir= query params used by every
// list endpoint. pageSize defaults to 10 (10 records per page, per request).

function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || 10, 1), 100);
  const offset = (page - 1) * pageSize;
  const search = (query.q || '').trim();
  return { page, pageSize, offset, search };
}

// allowedColumns: { clientKey: 'actual SQL column/expression' } — an
// allow-list so sortBy/sortDir from the querystring can never be used to
// inject arbitrary SQL. Returns the vetted SQL expression, not the raw
// client key.
function parseSort(query, allowedColumns, defaultKey) {
  const key = Object.prototype.hasOwnProperty.call(allowedColumns, query.sortBy) ? query.sortBy : defaultKey;
  const sortDir = String(query.sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { sortKey: key, sortColumn: allowedColumns[key], sortDir };
}

module.exports = { parsePagination, parseSort };
