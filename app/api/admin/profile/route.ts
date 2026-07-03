import { NextResponse } from 'next/server';
import { normalizeHandle } from '@/lib/handle';
import { isAdminEmail } from '@/lib/admin';
import { sendNotification } from '@/lib/notifications';
import { getSupportEmail } from '@/lib/support';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawHandle = String(searchParams.get('handle') || '').trim();
  const normalizedRaw = rawHandle.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
  if (normalizedRaw.length < 3) {
    return NextResponse.json({ error: 'Valid handle is required' }, { status: 400 });
  }
  const handle = normalizeHandle(rawHandle);

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,is_admin,top_streamer,can_stream_live,can_moderate')
    .eq('handle', handle)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const userLookup = await adminClient.auth.admin.getUserById(profile.id);
  const profileEmail = userLookup.data.user?.email || null;
  const isAdmin = Boolean(profile.is_admin) || isAdminEmail(profileEmail);

  return NextResponse.json({
    profile: {
      ...profile,
      is_admin: isAdmin,
      email: profileEmail,
    },
  });
}

export async function PATCH(request: Request) {
  const supportEmail = getSupportEmail();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    handle?: string;
    subscribers_count?: number;
    verified?: boolean;
    top_streamer?: boolean;
    suspended?: boolean;
    can_stream_live?: boolean;
    can_moderate?: boolean;
  };

  const rawHandle = (body.handle || '').trim();
  const normalizedRaw = rawHandle.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
  const handle = normalizeHandle(rawHandle);
  const subscribersCount =
    typeof body.subscribers_count === 'number' ? Math.max(0, Number(body.subscribers_count)) : undefined;
  const verified =
    typeof body.verified === 'boolean' ? body.verified : undefined;
  const topStreamer =
    typeof body.top_streamer === 'boolean' ? body.top_streamer : undefined;
  const suspended =
    typeof body.suspended === 'boolean' ? body.suspended : undefined;
  const canStreamLive =
    typeof body.can_stream_live === 'boolean' ? body.can_stream_live : undefined;
  const canModerate =
    typeof body.can_moderate === 'boolean' ? body.can_moderate : undefined;

  if (!body.handle || normalizedRaw.length < 3) {
    return NextResponse.json({ error: 'Valid handle is required' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, subscribers_count, verified, top_streamer, suspended, can_stream_live, can_moderate')
    .eq('handle', handle)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (
    subscribersCount === undefined &&
    verified === undefined &&
    topStreamer === undefined &&
    suspended === undefined &&
    canStreamLive === undefined &&
    canModerate === undefined
  ) {
    return NextResponse.json({ error: 'No admin changes provided' }, { status: 400 });
  }

  let data = profile;

  if (subscribersCount !== undefined || verified !== undefined || topStreamer !== undefined || suspended !== undefined) {
    const { data: rpcData, error } = await supabase.rpc('admin_update_profile_meta', {
      target_profile_id: profile.id,
      target_subscribers_count: subscribersCount ?? profile.subscribers_count,
      target_verified: verified ?? profile.verified,
      target_suspended: suspended ?? profile.suspended,
      target_top_streamer: topStreamer ?? profile.top_streamer,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    data = rpcData;
  }

  if (canStreamLive !== undefined) {
    const adminClient = createAdminClient();
    const { data: updatedLive, error: liveError } = await adminClient
      .from('profiles')
      .update({ can_stream_live: canStreamLive })
      .eq('id', profile.id)
      .select('id, subscribers_count, verified, top_streamer, suspended, can_stream_live, can_moderate')
      .single();
    if (liveError) {
      return NextResponse.json({ error: liveError.message }, { status: 400 });
    }
    data = updatedLive;
  }

  if (canModerate !== undefined) {
    const adminClient = createAdminClient();
    const { data: updatedModeration, error: moderationError } = await adminClient
      .from('profiles')
      .update({ can_moderate: canModerate })
      .eq('id', profile.id)
      .select('id, subscribers_count, verified, top_streamer, suspended, can_stream_live, can_moderate')
      .single();
    if (moderationError) {
      return NextResponse.json({ error: moderationError.message }, { status: 400 });
    }
    data = updatedModeration;
  }

  if (verified === true && profile.verified === false) {
    await sendNotification(supabase, {
      userId: profile.id,
      type: 'verified',
      message: "You've Been Verified! Congrats! 🎉",
      actorId: user.id,
    });
  }

  if (topStreamer === true && profile.top_streamer === false) {
    await sendNotification(supabase, {
      userId: profile.id,
      type: 'top_streamer_awarded',
      message: "You earned the Top ViewTube Streamer badge!",
      actorId: user.id,
      targetUrl: `/channel/${handle}`,
    });
  }

  if (suspended === true && profile.suspended === false) {
    await sendNotification(supabase, {
      userId: profile.id,
      type: 'account_suspended',
      message:
        `Your account has been suspended. Contact ${supportEmail}.`,
      actorId: user.id,
      targetUrl: '/suspended',
    });
  }

  if (suspended === false && profile.suspended === true) {
    await sendNotification(supabase, {
      userId: profile.id,
      type: 'account_unsuspended',
      message: 'Your account suspension has been lifted.',
      actorId: user.id,
      targetUrl: '/',
    });
  }

  if (canStreamLive === true && profile.can_stream_live === false) {
    await sendNotification(supabase, {
      userId: profile.id,
      type: 'live_access_enabled',
      message: 'Your channel is now approved for live streaming.',
      actorId: user.id,
      targetUrl: '/studio/live',
    });
  }

  return NextResponse.json({ profile: data });
}
