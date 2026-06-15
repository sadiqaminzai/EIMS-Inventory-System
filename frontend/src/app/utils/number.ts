// Currency-agnostic number formatting.
// EIMS tenants operate in different currencies (AFN, USD, ...), so dashboard
// totals are shown as plain formatted numbers without any currency symbol.

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Format a number with thousands separators and no decimals: 1250000 -> "1,250,000". */
export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
};

/** Compact form for tight spaces / chart axes: 1250000 -> "1.3M". */
export const formatCompact = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return compactFormatter.format(value);
};

/**
 * Percentage change between two periods.
 * Returns null when there is no meaningful baseline (previous period was 0).
 */
export const percentChange = (current: number, previous: number): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};
