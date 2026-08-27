import request from './client.js';
import { API_BASE } from '../utils/apiConfig.js';

export const sendOtp = (email) =>
  request('/auth/send-otp', { method: 'POST', body: { email } });

export const verifyOtp = (email, otp) =>
  request('/auth/verify-otp', { method: 'POST', body: { email, otp } });

export const sendForgotPasswordOtp = (identifier) =>
  request('/auth/forgot-password/send-otp', { method: 'POST', body: { identifier } });

export const verifyForgotPasswordOtp = (email, otp) =>
  request('/auth/forgot-password/verify-otp', { method: 'POST', body: { email, otp } });

export const resetPasswordWithOtp = (email, otp, new_password) =>
  request('/auth/forgot-password/reset', { method: 'POST', body: { email, otp, new_password } });

export const checkUsername = (username, excludeUid = null) => {
  const q = excludeUid ? `?exclude_uid=${encodeURIComponent(excludeUid)}` : '';
  return request(`/auth/check-username/${encodeURIComponent(username)}${q}`);
};

export const registerUser = (formData) => {
  return fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    body: formData,
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error?.message || data.error || 'Registration failed');
    }
    return data;
  });
};

export const loginUser = (identifier, password) =>
  request('/auth/login', { method: 'POST', body: { identifier, password } });

export const getProfile = (uid) =>
  request(`/auth/profile/${uid}`);

export const updateProfile = (uid, formData) => {
  return fetch(`${API_BASE}/api/auth/profile/${uid}`, {
    method: 'PUT',
    body: formData,
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error?.message || data.error || 'Update failed');
    }
    return data;
  });
};

export const changePassword = (uid, data) =>
  request(`/auth/profile/${uid}/change-password`, { method: 'POST', body: data });

export const getUserPreferences = (uid) =>
  request(`/auth/preferences/${uid}`);

export const saveUserPreferences = (uid, preferences) =>
  request(`/auth/preferences/${uid}`, { method: 'PUT', body: preferences });
