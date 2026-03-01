export const ADMIN_EMAIL = 'jesuslearningclub@gmail.com';

export function isAdminEmail(email?: string | null) {
  return (email || '').toLowerCase() === ADMIN_EMAIL;
}
