/**
 * Safe unique ID generator that works in all browsers and environments,
 * including insecure HTTP LAN IP contexts (e.g. http://192.168.1.x:5173/)
 * where window.crypto.randomUUID is not available.
 */
export function generateClientUid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if randomUUID fails
    }
  }
  return 'uid-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
}

export default generateClientUid;
