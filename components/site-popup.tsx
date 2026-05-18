import { createPublicClient } from '@/lib/supabase/public';
import { SitePopupModal } from '@/components/site-popup-modal';
import { unwrapRelation } from '@/lib/profile';

export async function SitePopup() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('site_popups')
    .select('id,message,expires_at,sound_enabled,admin:profiles!site_popups_created_by_fkey(username,handle,avatar_url,verified)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  type AdminProfileRow = {
    username: string | null;
    handle: string | null;
    avatar_url: string | null;
    verified: boolean | null;
  };

  type PopupRow = {
    id: string;
    message: string;
    expires_at: string | null;
    sound_enabled: boolean | null;
    admin: AdminProfileRow | AdminProfileRow[] | null;
  };

  const popup = (data?.[0] as unknown as PopupRow | undefined) ?? undefined;
  if (!popup?.id || !popup.message) return null;

  const admin = unwrapRelation(popup.admin);

  return (
    <SitePopupModal
      id={popup.id}
      message={popup.message}
      expiresAt={popup.expires_at ?? null}
      soundEnabled={Boolean(popup.sound_enabled)}
      admin={
        admin
          ? {
              username: String(admin.username || 'Admin'),
              handle: String(admin.handle || '@admin'),
              avatar_url: admin.avatar_url ?? null,
              verified: Boolean(admin.verified),
            }
          : null
      }
    />
  );
}
