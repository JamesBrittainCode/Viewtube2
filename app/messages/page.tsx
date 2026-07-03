import { redirect } from 'next/navigation';
import { MessagesInbox } from '@/components/messages/messages-inbox';
import { createClient } from '@/lib/supabase/server';

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  return <MessagesInbox currentUserId={user.id} />;
}
