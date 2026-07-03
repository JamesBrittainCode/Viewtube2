import { redirect } from 'next/navigation';
import { AdminProfileManager } from '@/components/admin-profile-manager';
import { AdminMessageCenter } from '@/components/admin/admin-message-center';
import { AdminPlayablesManager } from '@/components/admin/playables-manager';
import { AdminPointsAwarder } from '@/components/admin/admin-points-awarder';
import { canModerateUser, isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export default async function StudioAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  const canModerate = await canModerateUser(supabase, { id: user.id, email: user.email });
  if (!canModerate) redirect('/studio');
  const isAdmin = isAdminEmail(user.email);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-4xl font-bold">{isAdmin ? 'Admin' : 'Moderation'}</h1>
      {isAdmin ? <AdminMessageCenter /> : null}
      {isAdmin ? <AdminPointsAwarder /> : null}
      {isAdmin ? <AdminPlayablesManager /> : null}
      <AdminProfileManager isAdmin={isAdmin} />
    </div>
  );
}
