const REPORT_REASONS = [
  'Sexual content',
  'Violent or repulsive content',
  'Hateful or abusive content',
  'Harmful or dangerous acts',
  'Spam or misleading',
  'Child abuse',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

type ModerationResult = {
  flagged: boolean;
  reason?: string;
  details?: string[];
};

const DEFAULT_THRESHOLD = Number(process.env.MEDIA_MODERATION_THRESHOLD || '0.65');

function shouldBlock(value: number) {
  return Number.isFinite(value) && value >= DEFAULT_THRESHOLD;
}

async function runSightengineImage(url: string): Promise<ModerationResult> {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!apiUser || !apiSecret) {
    return { flagged: false };
  }

  const params = new URLSearchParams({
    models: 'nudity-2.1,offensive,gore,weapon,recreational_drug,violence',
    url,
    api_user: apiUser,
    api_secret: apiSecret,
  });
  const response = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Image moderation service failed');
  }
  const data = (await response.json()) as Record<string, unknown>;

  const nudity = data.nudity as Record<string, number> | undefined;
  const offensive = data.offensive as Record<string, number> | undefined;
  const gore = (data.gore as Record<string, number> | undefined)?.prob || 0;
  const weapon = (data.weapon as Record<string, number> | undefined)?.classes || {};
  const drugs = (data.recreational_drug as Record<string, number> | undefined)?.prob || 0;
  const violence = (data.violence as Record<string, number> | undefined)?.prob || 0;

  const weaponProb = Math.max(
    Number((weapon as Record<string, number>)?.firearm || 0),
    Number((weapon as Record<string, number>)?.knife || 0),
  );
  const sexualProb = Math.max(
    Number(nudity?.sexual_activity || 0),
    Number(nudity?.sexual_display || 0),
    Number(nudity?.erotica || 0),
  );
  const abusiveProb = Math.max(Number(offensive?.prob || 0), Number(offensive?.hate || 0));

  const hits: string[] = [];
  if (shouldBlock(sexualProb)) hits.push('sexual content');
  if (shouldBlock(gore) || shouldBlock(violence)) hits.push('violent/repulsive content');
  if (shouldBlock(abusiveProb)) hits.push('hateful/abusive content');
  if (shouldBlock(weaponProb) || shouldBlock(drugs)) hits.push('harmful/dangerous acts');

  if (!hits.length) return { flagged: false };
  return {
    flagged: true,
    reason: `Thumbnail flagged for ${hits.join(', ')}`,
    details: hits,
  };
}

async function runSightengineVideo(url: string): Promise<ModerationResult> {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!apiUser || !apiSecret) {
    return { flagged: false };
  }

  const params = new URLSearchParams({
    models: 'nudity-2.1,offensive,gore,weapon,recreational_drug,violence',
    url,
    api_user: apiUser,
    api_secret: apiSecret,
  });

  const response = await fetch(`https://api.sightengine.com/1.0/video/check-sync.json?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Video moderation service failed');
  }
  const data = (await response.json()) as Record<string, unknown>;
  const summary = (data.summary as Record<string, number> | undefined) || {};

  const sexualProb = Math.max(
    Number(summary.sexual || 0),
    Number(summary.nudity || 0),
  );
  const violenceProb = Math.max(
    Number(summary.gore || 0),
    Number(summary.violence || 0),
  );
  const abusiveProb = Number(summary.offensive || 0);
  const dangerousProb = Math.max(
    Number(summary.weapon || 0),
    Number(summary.recreational_drug || 0),
  );

  const hits: string[] = [];
  if (shouldBlock(sexualProb)) hits.push('sexual content');
  if (shouldBlock(violenceProb)) hits.push('violent/repulsive content');
  if (shouldBlock(abusiveProb)) hits.push('hateful/abusive content');
  if (shouldBlock(dangerousProb)) hits.push('harmful/dangerous acts');

  if (!hits.length) return { flagged: false };
  return {
    flagged: true,
    reason: `Video flagged for ${hits.join(', ')}`,
    details: hits,
  };
}

export async function moderateUploadedMedia(input: {
  videoUrl: string;
  thumbnailUrl: string;
}) {
  const required = process.env.REQUIRE_MEDIA_MODERATION !== 'false';
  const configured = Boolean(process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET);
  if (required && !configured) {
    return {
      flagged: true as const,
      reason:
        'Automatic media moderation is not configured yet. Set SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET.',
    };
  }
  if (!configured) {
    return { flagged: false as const };
  }

  const [videoResult, imageResult] = await Promise.all([
    runSightengineVideo(input.videoUrl),
    runSightengineImage(input.thumbnailUrl),
  ]);

  if (!videoResult.flagged && !imageResult.flagged) {
    return { flagged: false as const };
  }

  const reasons = [videoResult.reason, imageResult.reason].filter(Boolean).join(' | ');
  return {
    flagged: true as const,
    reason: reasons || 'Media moderation flagged this upload.',
  };
}

export const VIDEO_REPORT_REASONS = REPORT_REASONS;

