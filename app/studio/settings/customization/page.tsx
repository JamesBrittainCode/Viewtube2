import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChannelCustomization } from '@/components/studio/channel-customization';

export const runtime = 'edge';

export default async function StudioChannelCustomizationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username,handle,bio,avatar_url,banner_url')
    .eq('id', user.id)
    .single();

  return (
    <ChannelCustomization
      initialProfile={{
        username: profile?.username || '',
        handle: profile?.handle || '',
        bio: profile?.bio || '',
        avatar_url: profile?.avatar_url || null,
        banner_url: profile?.banner_url || null,
      }}
    />
  );
}

