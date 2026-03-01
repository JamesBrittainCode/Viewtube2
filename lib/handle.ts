export function normalizeHandle(input: string) {
  const stripped = input.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '');
  const safe = stripped.length >= 3 ? stripped.slice(0, 30) : 'user';
  return `@${safe}`;
}
