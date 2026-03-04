import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    paypal_transaction_id?: string;
    payment_amount_usd?: number;
  };

  const paypalTransactionId = String(body.paypal_transaction_id || '').trim();
  const paymentAmount = Number(body.payment_amount_usd || 0);
  if (!paypalTransactionId || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return NextResponse.json({ error: 'Payment details are required' }, { status: 400 });
  }

  const { data: submission, error: submissionError } = await supabase
    .from('ad_submissions')
    .select('id,status,calculated_price_usd,contact_email')
    .eq('id', submissionId)
    .eq('contact_email', user.email.toLowerCase())
    .maybeSingle();

  if (submissionError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }
  if (submission.status !== 'approved_pending_payment') {
    return NextResponse.json({ error: 'This submission is not ready for payment' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ad_submissions')
    .update({
      paypal_transaction_id: paypalTransactionId,
      payment_amount_usd: paymentAmount,
      status: 'paid_pending_launch',
    })
    .eq('id', submissionId)
    .select('id,status,paypal_transaction_id,payment_amount_usd')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ submission: data });
}
