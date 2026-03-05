import { NextResponse } from 'next/server';
import { calculateAdPricing } from '@/lib/ad-pricing';
import { sendAdminNewAdRequestEmail } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';

function toIsoOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    first_name?: string;
    last_name?: string;
    position_title?: string;
    company_name?: string;
    contact_email?: string;
    ad_title?: string;
    click_url?: string;
    video_url?: string;
    thumbnail_url?: string | null;
    runtime_seconds?: number;
    target_reach?: number;
    skippable?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  };

  const firstName = String(body.first_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  const positionTitle = String(body.position_title || '').trim();
  const companyName = String(body.company_name || '').trim();
  const submitterEmail = String(user.email || '').trim().toLowerCase();
  const contactEmail = String(body.contact_email || '').trim().toLowerCase();
  const adTitle = String(body.ad_title || '').trim();
  const clickUrl = String(body.click_url || '').trim();
  const videoUrl = String(body.video_url || '').trim();
  const thumbnailUrl = String(body.thumbnail_url || '').trim() || null;
  const runtimeSeconds = Math.max(0, Math.round(Number(body.runtime_seconds || 0)));
  const targetReach = Math.max(0, Math.round(Number(body.target_reach || 0)));
  const skippable = body.skippable !== false;
  const startsAt = toIsoOrNull(body.starts_at);
  const endsAt = toIsoOrNull(body.ends_at);

  if (
    !firstName ||
    !lastName ||
    !positionTitle ||
    !companyName ||
    !submitterEmail ||
    !contactEmail ||
    !adTitle ||
    !clickUrl ||
    !videoUrl
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  try {
    new URL(clickUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid click URL' }, { status: 400 });
  }

  if (runtimeSeconds <= 0 || runtimeSeconds > 180) {
    return NextResponse.json({ error: 'Ad runtime must be between 1 and 180 seconds' }, { status: 400 });
  }
  if (targetReach < 100) {
    return NextResponse.json({ error: 'Target reach must be at least 100 people' }, { status: 400 });
  }

  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
  }

  const pricing = calculateAdPricing({
    runtimeSeconds,
    targetReach,
    startsAt,
    endsAt,
  });

  const { data, error } = await supabase
    .from('ad_submissions')
    .insert({
      first_name: firstName,
      last_name: lastName,
      position_title: positionTitle,
      company_name: companyName,
      submitter_email: submitterEmail,
      contact_email: contactEmail,
      ad_title: adTitle,
      click_url: clickUrl,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      runtime_seconds: runtimeSeconds,
      target_reach: pricing.targetReach,
      calculated_price_usd: pricing.estimatedPriceUsd,
      skippable,
      starts_at: startsAt,
      ends_at: endsAt,
      paypal_transaction_id: null,
      payment_amount_usd: null,
      payment_provider: null,
      payment_reference: null,
      paid_at: null,
      status: 'pending',
    })
    .select('id,status,created_at,calculated_price_usd,target_reach')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let emailSent = false;
  let adminEmailError: string | null = null;
  try {
    await sendAdminNewAdRequestEmail({
      submissionId: data.id,
      advertiserName: `${firstName} ${lastName}`,
      companyName,
      adTitle,
      estimatedPriceUsd: pricing.estimatedPriceUsd,
    });
    emailSent = true;
  } catch (err) {
    console.error('Failed to send admin ad request email', err);
    adminEmailError =
      process.env.NODE_ENV === 'production'
        ? 'Admin email failed'
        : (err as Error)?.message || 'Admin email failed';
  }

  return NextResponse.json({ submission: data, email_sent: emailSent, email_error: adminEmailError });
}
