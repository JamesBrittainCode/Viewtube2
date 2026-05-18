import { createPublicClient } from '@/lib/supabase/public';
import { SiteAlertBanner } from '@/components/site-alert-banner';

export async function SiteAlert() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('site_alerts')
    .select('id,message')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  const alert = data?.[0];
  if (!alert?.id || !alert.message) return null;
  return <SiteAlertBanner id={alert.id} message={alert.message} />;
}
