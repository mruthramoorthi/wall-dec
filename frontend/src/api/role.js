const API = '/api/roles';

export async function listRoles(opts = {}) {
  const params = new URLSearchParams();
  if (opts.search) params.append('search', opts.search);
  if (opts.active_only) params.append('active_only', '1');
  if (opts.page) params.append('page', opts.page);
  if (opts.pageSize) params.append('pageSize', opts.pageSize);

  const url = params.toString() ? `${API}?${params}` : API;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch roles');
  return res.json();
}

export async function getRole(uid) {
  const res = await fetch(`${API}/${encodeURIComponent(uid)}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch role');
  return res.json();
}

export async function createRole(data) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to create role');
  return json;
}

export async function updateRole(uid, data) {
  const res = await fetch(`${API}/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update role');
  return json;
}

export async function deleteRole(uid) {
  const res = await fetch(`${API}/${encodeURIComponent(uid)}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete role');
  return json;
}
