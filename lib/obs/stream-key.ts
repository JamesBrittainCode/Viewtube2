import crypto from 'node:crypto';

export function generateStreamKey() {
  // 32 bytes -> 43-ish chars base64url, safe for RTMP path segment.
  return crypto.randomBytes(32).toString('base64url');
}

export function hashStreamKey(streamKey: string) {
  const pepper = process.env.STREAM_KEY_PEPPER;
  if (!pepper) throw new Error('Missing STREAM_KEY_PEPPER');
  return crypto.createHmac('sha256', pepper).update(streamKey).digest('hex');
}

export function last4(streamKey: string) {
  const s = String(streamKey || '');
  return s.length <= 4 ? s : s.slice(-4);
}

