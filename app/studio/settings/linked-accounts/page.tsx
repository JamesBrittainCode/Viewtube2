import { LinkedAccountsSettings } from '@/components/studio/linked-accounts-settings';

export default async function StudioLinkedAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  return <LinkedAccountsSettings initialKey={String(params?.key || '')} />;
}
