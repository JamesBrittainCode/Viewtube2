import { redirect } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { AdminAdCampaignList, type AdminAdPreviewItem } from '@/components/admin/admin-ad-campaign-list';
import { AdminBannerAdWorkspace } from '@/components/admin/admin-banner-ad-workspace';
import { AdminAdWorkspace } from '@/components/admin/admin-ad-workspace';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export default async function StudioAdminAdsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  if (!isAdminEmail(user.email)) redirect('/studio/admin');

  const [{ data: ads }, { data: submissions }, { data: bannerAds }] = await Promise.all([
    supabase
      .from('ads')
      .select(
        'id,title,video_url,click_url,thumbnail_url,logo_url,banner_url,runtime_seconds,target_reach,calculated_price_usd,skippable,approved,starts_at,ends_at,is_active,impressions_count,clicks_count,completions_count,created_at',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('ad_submissions')
      .select(
        'id,ad_title,company_name,video_url,click_url,thumbnail_url,logo_url,banner_url,runtime_seconds,skippable,status,created_at',
      )
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('banner_ads')
      .select('id,title,image_url,click_url,placement,approved,is_active,starts_at,ends_at,impressions_count,clicks_count,created_at')
      .order('created_at', { ascending: false }),
  ]);

  const liveAds: AdminAdPreviewItem[] = (ads || []).map((item) => ({
    id: item.id,
    source: 'live',
    title: item.title,
    video_url: item.video_url,
    click_url: item.click_url,
    thumbnail_url: item.thumbnail_url,
    logo_url: item.logo_url,
    banner_url: item.banner_url,
    runtime_seconds: item.runtime_seconds,
    target_reach: item.target_reach,
    calculated_price_usd: item.calculated_price_usd,
    skippable: item.skippable,
    approved: item.approved,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    is_active: item.is_active,
    impressions_count: item.impressions_count,
    clicks_count: item.clicks_count,
    completions_count: item.completions_count,
    created_at: item.created_at,
    status: item.is_active && item.approved ? 'Active' : item.approved ? 'Approved paused' : 'Not approved',
  }));

  const submittedAds: AdminAdPreviewItem[] = (submissions || []).map((item) => ({
    id: item.id,
    source: 'submission',
    title: item.ad_title,
    company: item.company_name,
    video_url: item.video_url,
    click_url: item.click_url,
    thumbnail_url: item.thumbnail_url,
    logo_url: item.logo_url,
    banner_url: item.banner_url,
    runtime_seconds: item.runtime_seconds,
    skippable: item.skippable,
    created_at: item.created_at,
    status: `Submission: ${item.status}`,
  }));

  const items = [...liveAds, ...submittedAds];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950/30 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-red-600 p-3 text-white">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">Upload ads</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Upload campaigns, edit live ads, and review exactly how they will feel on ViewTube: the in-video sponsored
              overlay, optional sidebar companion banner, logo, and click destination.
            </p>
          </div>
        </div>
      </div>

      <AdminAdWorkspace />
      <AdminBannerAdWorkspace initialBannerAds={bannerAds || []} />
      <AdminAdCampaignList items={items} />
    </div>
  );
}
