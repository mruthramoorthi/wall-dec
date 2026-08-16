const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function listPaymentModes(page = 1, pageSize = 20, opts = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (opts.search || opts.q) params.set('search', opts.search || opts.q);
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.sortDir) params.set('sortDir', opts.sortDir);
  if (opts.all) params.set('all', 'true');
  if (opts.activeOnly) params.set('activeOnly', 'true');

  const res = await fetch(`${API_BASE}/api/payment-mode?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to list payment modes');
  }
  return res.json();
}

export async function getPaymentMode(uid) {
  const res = await fetch(`${API_BASE}/api/payment-mode/${uid}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch payment mode');
  }
  return res.json();
}

export async function createPaymentMode(data) {
  const res = await fetch(`${API_BASE}/api/payment-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create payment mode');
  }
  return res.json();
}

export async function updatePaymentMode(uid, data) {
  const res = await fetch(`${API_BASE}/api/payment-mode/${uid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update payment mode');
  }
  return res.json();
}

export async function deletePaymentMode(uid) {
  const res = await fetch(`${API_BASE}/api/payment-mode/${uid}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete payment mode');
  }
  return res.json();
}
