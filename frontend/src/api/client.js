// Thin fetch wrapper shared by every resource module in src/api/.
const BASE = '/api';

async function request(path, { method = 'GET', body, isForm } = {}) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData - browser sets the multipart boundary header
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.field = data?.error?.field || null;
    err.status = res.status;
    throw err;
  }
  return data;
}

export default request;
