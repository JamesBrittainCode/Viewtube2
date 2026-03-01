export function formatCompactCount(value: number) {
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${trimTrailing(value / 1_000_000_000, 2)}B`;
  }

  if (abs >= 1_000_000) {
    return `${trimTrailing(value / 1_000_000, 2)}M`;
  }

  if (abs >= 1_000) {
    return `${trimTrailing(value / 1_000, 1)}K`;
  }

  return value.toLocaleString();
}

function trimTrailing(value: number, maxDecimals: number) {
  return value.toFixed(maxDecimals).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/g, '');
}
