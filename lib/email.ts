import { ADMIN_EMAIL } from '@/lib/admin';

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith('http')
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

async function sendEmail({ to, subject, html }: SendEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'ViewTube <noreply@viewtube.tv>';

  if (!apiKey) {
    console.warn('Email skipped: RESEND_API_KEY is not set');
    return;
  }

  const toList = Array.isArray(to) ? to : [to];
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: toList,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed: ${body}`);
  }
}

function getAdminAlertEmail() {
  return (
    process.env.ADMIN_ALERT_EMAIL?.trim().toLowerCase() ||
    ADMIN_EMAIL
  );
}

export async function sendAdminNewAdRequestEmail(input: {
  submissionId: string;
  advertiserName: string;
  companyName: string;
  adTitle: string;
  estimatedPriceUsd: number;
}) {
  const portalUrl = `${getBaseUrl()}/studio/admin`;
  const adminTo = getAdminAlertEmail();
  await sendEmail({
    to: adminTo,
    subject: `New ViewTube Ad Request: ${input.adTitle}`,
    html: `
      <p>A new ad request was submitted.</p>
      <ul>
        <li><strong>Submission ID:</strong> ${input.submissionId}</li>
        <li><strong>Advertiser:</strong> ${input.advertiserName}</li>
        <li><strong>Company:</strong> ${input.companyName}</li>
        <li><strong>Ad Title:</strong> ${input.adTitle}</li>
        <li><strong>Estimated Budget:</strong> $${input.estimatedPriceUsd.toFixed(2)}</li>
      </ul>
      <p><a href="${portalUrl}">Review in Studio Admin</a></p>
    `,
  });
}

export async function sendAdvertiserReviewEmail(input: {
  toEmails: string[];
  adTitle: string;
  decision: 'approved' | 'rejected';
  reviewNotes?: string | null;
}) {
  const recipients = Array.from(
    new Set(
      input.toEmails
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (!recipients.length) {
    return;
  }

  const portalUrl = `${getBaseUrl()}/advertise/portal`;
  const subject =
    input.decision === 'approved'
      ? `Your ViewTube Ad Was Approved: ${input.adTitle}`
      : `Your ViewTube Ad Was Rejected: ${input.adTitle}`;

  const summary =
    input.decision === 'approved'
      ? 'Your campaign has been approved. Please complete payment in the advertiser portal to launch.'
      : 'Your campaign was not approved at this time.';

  await sendEmail({
    to: recipients,
    subject,
    html: `
      <p>${summary}</p>
      <p><strong>Ad:</strong> ${input.adTitle}</p>
      ${
        input.reviewNotes
          ? `<p><strong>Review Notes:</strong> ${input.reviewNotes}</p>`
          : ''
      }
      <p><a href="${portalUrl}">Open Advertiser Portal</a></p>
    `,
  });
}

export async function sendAdvertiserCampaignLiveEmail(input: {
  toEmails: string[];
  adTitle: string;
  paid: boolean;
}) {
  const recipients = Array.from(
    new Set(
      input.toEmails
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (!recipients.length) {
    return;
  }

  const portalUrl = `${getBaseUrl()}/advertise/portal`;
  const paymentLine = input.paid
    ? 'Your payment was confirmed and your campaign is now live.'
    : 'Your campaign was launched and is now live.';

  await sendEmail({
    to: recipients,
    subject: `Your ViewTube Ad Is Live: ${input.adTitle}`,
    html: `
      <p>${paymentLine}</p>
      <p><strong>Ad:</strong> ${input.adTitle}</p>
      <p><a href="${portalUrl}">Open Advertiser Portal</a></p>
    `,
  });
}
