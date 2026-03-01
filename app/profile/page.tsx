import Image from 'next/image';
import { redirect } from 'next/navigation';
import { AvatarUpload } from '@/components/avatar-upload';
import { ProfileEditor } from '@/components/profile-editor';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mb-6 text-2xl font-bold">Profile settings</h1>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="space-y-4">
          <Image
            src={profile?.avatar_url || '/avatar-placeholder.svg'}
            alt="Avatar"
            width={160}
            height={160}
            className="h-40 w-40 rounded-full object-cover"
          />
          <AvatarUpload />
        </div>

        <ProfileEditor
          username={profile?.username || ''}
          handle={profile?.handle || '@user'}
          bio={profile?.bio || ''}
        />
      </div>
    </section>
  );
}
