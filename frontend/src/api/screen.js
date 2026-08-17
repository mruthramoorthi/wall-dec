const API = '/api';

export async function listScreens() {
  const res = await fetch(`${API}/screens`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch screens');
  return res.json();
}

export const getAllScreens = listScreens;

export async function getPermissionsMatrix() {
  const res = await fetch(`${API}/screens/permissions`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch permissions matrix');
  return res.json();
}

export async function savePermissionsMatrix(matrix) {
  const res = await fetch(`${API}/screens/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matrix })
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to save permissions');
  return res.json();
}

export async function toggleScreenActive(screenKey, isActive) {
  const res = await fetch(`${API}/screens/toggle-active/${encodeURIComponent(screenKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive })
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to toggle screen active status');
  return res.json();
}

export async function getMyScreens(userUid = null) {
  const url = userUid ? `${API}/screens/my-screens?user_uid=${encodeURIComponent(userUid)}` : `${API}/screens/my-screens`;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch authorized screens');
  return res.json();
}

export async function testSmtpConnection(data) {
  const res = await fetch(`${API}/company/test-smtp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'SMTP test failed');
  return json;
}
