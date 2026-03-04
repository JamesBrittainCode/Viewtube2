import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { sendAdvertiserReviewEmail } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';

function toIsoOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('ad_submissions')
    .select(
      'id,first_name,last_name,position_title,company_name,submitter_email,contact_email,ad_title,click_url,video_url,thumbnail_url,runtime_seconds,target_reach,calculated_price_usd,skippable,starts_at,ends_at,paypal_transaction_id,payment_amount_usd,status,review_notes,reviewed_at,reviewed_by,converted_ad_id,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ submissions: data || [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    action?: 'approve' | 'reject' | 'launch_paid';
    review_notes?: string;
    starts_at?: string | null;
    ends_at?: string | null;
    force_active?: boolean;
  };

  if (!body.id || !body.action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
  }

  const { data: submission, error: fetchError } = await supabase
    .from('ad_submissions')
    .select(
      'id,submitter_email,contact_email,ad_title,video_url,click_url,thumbnail_url,runtime_seconds,target_reach,calculated_price_usd,skippable,status,starts_at,ends_at,payment_amount_usd,paypal_transaction_id',
    )
    .eq('id', body.id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const reviewNotes = (body.review_notes || '').trim() || null;
  const startsAt = toIsoOrNull(body.starts_at) ?? submission.starts_at ?? null;
  const endsAt = toIsoOrNull(body.ends_at) ?? submission.ends_at ?? null;
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return NextResponse.json({ error: 'ends_at must be after starts_at' }, { status: 400 });
  }

  if (body.action === 'reject') {
    const { data, error } = await supabase
      .from('ad_submissions')
      .update({
        status: 'rejected',
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', body.id)
      .select(
        'id,first_name,last_name,company_name,ad_title,status,review_notes,reviewed_at,reviewed_by',
      )
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    try {
      await sendAdvertiserReviewEmail({
        toEmails: [submission.submitter_email, submission.contact_email],
        adTitle: submission.ad_title,
        decision: 'rejected',
        reviewNotes,
      });
    } catch (emailError) {
      console.error('Failed to send advertiser rejection email', emailError);
    }
    return NextResponse.json({ submission: data });
  }

  if (body.action === 'approve') {
    const { data, error } = await supabase
      .from('ad_submissions')
      .update({
        status: 'approved_pending_payment',
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        starts_at: startsAt,
        ends_at: endsAt,
      })
      .eq('id', body.id)
      .select(
        'id,first_name,last_name,company_name,ad_title,status,review_notes,reviewed_at,reviewed_by,starts_at,ends_at,payment_amount_usd,paypal_transaction_id',
      )
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    try {
      await sendAdvertiserReviewEmail({
        toEmails: [submission.submitter_email, submission.contact_email],
        adTitle: submission.ad_title,
        decision: 'approved',
        reviewNotes,
      });
    } catch (emailError) {
      console.error('Failed to send advertiser approval email', emailError);
    }
    return NextResponse.json({ submission: data });
  }

  if (submission.status !== 'paid_pending_launch' && submission.status !== 'approved_pending_payment') {
    return NextResponse.json({ error: 'Submission must be approved and paid before launch' }, { status: 400 });
  }

  if (!submission.paypal_transaction_id) {
    return NextResponse.json({ error: 'No payment transaction found for this submission' }, { status: 400 });
  }

  const { data: adRow, error: adError } = await supabase
    .from('ads')
    .insert({
      title: submission.ad_title,
      video_url: submission.video_url,
      click_url: submission.click_url,
      thumbnail_url: submission.thumbnail_url,
      runtime_seconds: submission.runtime_seconds || 0,
      target_reach: submission.target_reach || null,
      calculated_price_usd: submission.calculated_price_usd || null,
      skippable: submission.skippable !== false,
      approved: true,
      starts_at: startsAt,
      ends_at: endsAt,
      source_submission_id: submission.id,
      is_active: body.force_active !== false,
      created_by: user.id,
    })
    .select(
      'id,title,video_url,click_url,thumbnail_url,runtime_seconds,skippable,approved,starts_at,ends_at,is_active,created_at',
    )
    .single();

  if (adError || !adRow) {
    return NextResponse.json({ error: adError?.message || 'Failed to create ad' }, { status: 400 });
  }

  const { data: updatedSubmission, error: updateSubmissionError } = await supabase
    .from('ad_submissions')
    .update({
      status: 'approved',
      review_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      converted_ad_id: adRow.id,
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .eq('id', body.id)
    .select(
      'id,first_name,last_name,company_name,ad_title,status,review_notes,reviewed_at,reviewed_by,converted_ad_id',
    )
    .single();

  if (updateSubmissionError) {
    return NextResponse.json({ error: updateSubmissionError.message }, { status: 400 });
  }

  return NextResponse.json({ submission: updatedSubmission, ad: adRow });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase.from('ad_submissions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id });
}
