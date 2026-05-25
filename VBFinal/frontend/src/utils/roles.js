export const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('admin')) return 'admin';
  if (value.includes('officer')) return 'officer';
  return value;
};

export const isOfficerRole = (role) => normalizeRole(role) === 'officer';
