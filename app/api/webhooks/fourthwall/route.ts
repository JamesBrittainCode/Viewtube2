import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

type FourthwallPayload = {
  event?: string;
  type?: string;
  eventType?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const candidate = readString(value);
    if (candidate) return candidate;
  }
  return null;
}

function pickNested(root: Record<string, unknown> | undefined, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function pickEventType(body: FourthwallPayload): string {
  return String(body.event || body.type || body.eventType || '').toLowerCase();
}

function isPaidEvent(type: string) {
  return (
    type.includes('order_placed') ||
    type.includes('order.paid') ||
    type.includes('order_paid') ||
    type.includes('checkout.completed')
  );
}

function timingSafeEqualText(a: string, b: string) {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyFourthwallSignature(rawBody: string, secret: string, signatureHeader: string | null) {
  if (!signatureHeader) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return timingSafeEqualText(computed, signatureHeader.trim());
}

export async function POST(request: Request) {
  const configuredSecret = process.env.FOURTHWALL_WEBHOOK_SECRET?.trim();
  const rawBody = await request.text();
  if (configuredSecret) {
    const hmacHeader =
      request.headers.get('x-fourthwall-hmac-sha256') ||
      request.headers.get('X-Fourthwall-Hmac-SHA256') ||
      request.headers.get('x-fourthwall-hmac-apps-sha256') ||
      request.headers.get('X-Fourthwall-Hmac-Apps-SHA256');

    const validSignature = verifyFourthwallSignature(rawBody, configuredSecret, hmacHeader);
    if (!validSignature) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
  }

  let body: FourthwallPayload = {};
  try {
    body = (JSON.parse(rawBody || '{}') || {}) as FourthwallPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  const eventType = pickEventType(body);
  if (!isPaidEvent(eventType)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const root = (body.data || body.payload || body) as Record<string, unknown>;
  const orderId = firstString(
    root.id,
    root.orderId,
    pickNested(root, ['order', 'id']),
    pickNested(root, ['order', 'orderId']),
  );
  const buyerEmail = firstString(
    root.email,
    pickNested(root, ['customer', 'email']),
    pickNested(root, ['order', 'email']),
    pickNested(root, ['order', 'customer', 'email']),
  )?.toLowerCase();
  const submissionId = firstString(
    root.submissionId,
    root.submission_id,
    pickNested(root, ['metadata', 'submission_id']),
    pickNested(root, ['metadata', 'submissionId']),
    pickNested(root, ['order', 'metadata', 'submission_id']),
    pickNested(root, ['order', 'metadata', 'submissionId']),
    pickNested(root, ['customFields', 'submission_id']),
  );

  const amountRaw =
    readNumber(root.total) ??
    readNumber(root.amount) ??
    readNumber(pickNested(root, ['order', 'total'])) ??
    readNumber(pickNested(root, ['order', 'amount'])) ??
    0;
  const amount = amountRaw > 1000 ? amountRaw / 100 : amountRaw;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let target:
    | {
        id: string;
        status: string;
        calculated_price_usd: number | null;
      }
    | null = null;

  if (submissionId) {
    const { data } = await supabase
      .from('ad_submissions')
      .select('id,status,calculated_price_usd')
      .eq('id', submissionId)
      .in('status', ['approved_pending_payment', 'paid_pending_launch'])
      .maybeSingle();
    target = data;
  }

  if (!target && buyerEmail) {
    const { data } = await supabase
      .from('ad_submissions')
      .select('id,status,calculated_price_usd')
      .eq('submitter_email', buyerEmail)
      .eq('status', 'approved_pending_payment')
      .order('created_at', { ascending: true })
      .limit(5);

    if (data?.length) {
      const withScore = data.map((item) => ({
        item,
        diff: Math.abs((item.calculated_price_usd || 0) - (amount || 0)),
      }));
      withScore.sort((a, b) => a.diff - b.diff);
      target = withScore[0].item;
    }
  }

  if (!target) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const paymentRef = orderId || `fourthwall-${Date.now()}`;
  const { error } = await supabase
    .from('ad_submissions')
    .update({
      status: 'paid_pending_launch',
      payment_provider: 'fourthwall',
      payment_reference: paymentRef,
      paypal_transaction_id: paymentRef,
      payment_amount_usd: amount || target.calculated_price_usd || 0,
      paid_at: new Date().toISOString(),
    })
    .eq('id', target.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, matched: true, submission_id: target.id });
}
