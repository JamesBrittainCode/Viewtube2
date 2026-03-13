import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudioLiveManager } from '@/components/studio-live-manager';
import { LivePolicyGate } from '@/components/live-policy-gate';

export default async function StudioLivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const [{ data: profile }, { data: activeStream }] = await Promise.all([
    supabase.from('profiles').select('can_stream_live').eq('id', user.id).single(),
    supabase
      .from('live_streams')
      .select('id,title,description,is_live,started_at')
      .eq('user_id', user.id)
      .eq('is_live', true)
      .order('started_at', { ascending: false })
      .maybeSingle(),
  ]);

  if (!profile?.can_stream_live) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
        <h1 className="text-2xl font-bold">Live Streaming Access Required</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your account is not enabled for live streaming yet. Ask a ViewTube admin to enable live streaming for your channel.
        </p>
      </div>
    );
  }

  return (
    <LivePolicyGate role="creator">
      <div className="mx-auto max-w-4xl">
        <StudioLiveManager activeStream={activeStream || null} />
      </div>
    </LivePolicyGate>
  );
}
