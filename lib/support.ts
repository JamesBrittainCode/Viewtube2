export function getSupportEmail() {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'support@viewtube.tv';
}

