import { NextResponse } from 'next/server';

export async function POST(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  return NextResponse.json(
    {
      error:
        `Manual payment confirmation is disabled for ${submissionId}. ` +
        'Use Fourthwall checkout. Status updates automatically after webhook confirmation.',
    },
    { status: 410 },
  );
}
