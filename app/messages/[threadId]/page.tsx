import { redirect } from 'next/navigation';
import { MessageThread } from '@/components/messages/message-thread';
import { createClient } from '@/lib/supabase/server';

export default async function MessageThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { threadId } = await params;
  return <MessageThread threadId={threadId} />;
}
