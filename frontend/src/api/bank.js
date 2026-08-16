const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function listBanks(page = 1, pageSize = 20, opts = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (opts.search || opts.q) params.set('search', opts.search || opts.q);
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.sortDir) params.set('sortDir', opts.sortDir);
  if (opts.all) params.set('all', 'true');

  const res = await fetch(`${API_BASE}/api/bank?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to list bank accounts');
  }
  return res.json();
}

export async function getBank(uid) {
  const res = await fetch(`${API_BASE}/api/bank/${uid}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch bank account');
  }
  return res.json();
}

export async function createBank(data) {
  const res = await fetch(`${API_BASE}/api/bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create bank account');
  }
  return res.json();
}

export async function updateBank(uid, data) {
  const res = await fetch(`${API_BASE}/api/bank/${uid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update bank account');
  }
  return res.json();
}

export async function deleteBank(uid) {
  const res = await fetch(`${API_BASE}/api/bank/${uid}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete bank account');
  }
  return res.json();
}
