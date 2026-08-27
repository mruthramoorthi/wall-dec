// Centralized API and image URL resolution
// Supports localhost, LAN IP (e.g. 192.168.x.x), Vite dev proxy, and cloud deployment via VITE_API_URL in .env

export const VITE_API_URL = import.meta.env.VITE_API_URL || '';

export const API_BASE = VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : 'http://localhost:4000'
);

export function getImageUrl(filename, size = 'auto') {
  if (!filename) return '';
  if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('data:')) {
    return filename;
  }

  // Build query string for on-the-fly Sharp optimization
  let query = '?format=webp';
  if (size === 'thumb') {
    query = '?w=400&q=80&format=webp';
  } else if (size === 'medium') {
    query = '?w=800&q=85&format=webp';
  } else if (size === 'icon') {
    query = '?w=120&q=75&format=webp';
  } else if (size === 'original') {
    query = '?q=90&format=webp';
  }

  // If an explicit backend URL is defined in .env, use that:
  if (VITE_API_URL) {
    return `${VITE_API_URL.replace(/\/$/, '')}/images/${filename}${query}`;
  }
  // In local dev with Vite proxy, relative /images/ routes through Vite dev server to backend automatically:
  return `/images/${filename}${query}`;
}
