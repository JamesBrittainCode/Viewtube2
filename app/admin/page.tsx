import { redirect } from 'next/navigation';
import { AdminProfileManager } from '@/components/admin-profile-manager';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  if (!isAdminEmail(user.email)) redirect('/');

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Admin Settings</h1>
      <AdminProfileManager />
    </div>
  );
}
