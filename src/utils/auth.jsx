export function normalizeRole(role) {
  const value = String(role || '').trim().toUpperCase();

  if (!value) return 'ROLE_TRAVELLER';

  if (value.startsWith('ROLE_')) {
    return value;
  }

  if (['USER', 'TRAVELLER', 'CUSTOMER'].includes(value)) {
    return 'ROLE_TRAVELLER';
  }

  if (value === 'PARTNER') return 'ROLE_PARTNER';
  if (value === 'ADMIN') return 'ROLE_ADMIN';

  return `ROLE_${value}`;
}

export function getHomePathForRole(role) {
  switch (normalizeRole(role)) {
    case 'ROLE_ADMIN':
      return '/admin';

    case 'ROLE_PARTNER':
      return '/partner';

    default:
      return '/home';
  }
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}
