import { redirect } from 'next/navigation';
import { AdminProfileManager } from '@/components/admin-profile-manager';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export default async function StudioAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  if (!isAdminEmail(user.email)) redirect('/studio');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-4xl font-bold">Admin</h1>
      <AdminProfileManager />
    </div>
  );
}
