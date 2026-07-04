import { redirect } from 'next/navigation';
import { MessagesInbox } from '@/components/messages/messages-inbox';
import { checkFamilyPermission } from '@/lib/family-controls';
import { createClient } from '@/lib/supabase/server';

export default async function MessageThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const familyMessages = await checkFamilyPermission(user.id, 'messages');
  if (!familyMessages.allowed) redirect('/');

  const { threadId } = await params;
  return <MessagesInbox currentUserId={user.id} selectedThreadId={threadId} />;
}
