export type AdPricingInput = {
  runtimeSeconds: number;
  targetReach: number;
  skippable?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type AdPricingResult = {
  runtimeSeconds: number;
  targetReach: number;
  campaignDays: number;
  estimatedPriceUsd: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getCampaignDays(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt || !endsAt) return 7;
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 7;
  return Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
}

export function calculateAdPricing(input: AdPricingInput): AdPricingResult {
  const runtimeSeconds = clamp(Math.round(input.runtimeSeconds || 0), 1, 180);
  const targetReach = clamp(Math.round(input.targetReach || 0), 100, 50000000);
  const campaignDays = getCampaignDays(input.startsAt, input.endsAt);
  const skippable = input.skippable !== false;

  const baseCpm = 1.1;
  const runtimeMultiplier = clamp(0.8 + (runtimeSeconds / 60) * 0.35, 0.8, 1.9);
  const durationMultiplier = 1 + Math.log2(campaignDays + 1) * 0.08;
  const nonSkippableMultiplier = skippable ? 1 : 1.65;
  const reachUnits = targetReach / 1000;
  const raw = reachUnits * baseCpm * runtimeMultiplier * durationMultiplier * nonSkippableMultiplier;
  const estimatedPriceUsd = round2(Math.max(4.5, raw) + 2);

  return {
    runtimeSeconds,
    targetReach,
    campaignDays,
    estimatedPriceUsd,
  };
}
