/** Format a duration in milliseconds, e.g. a gap between two timestamps. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return formatDurationSeconds(ms / 1000);
}

/** Format a duration in seconds, e.g. a flow run's (see parseDuration). */
export function formatDurationSeconds(secs: number): string {
  if (secs <= 0) return '0s';
  if (secs < 60) return `${Math.round(secs)}s`;
  const minutes = Math.floor(secs / 60);
  const remainingSeconds = Math.round(secs % 60);
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}m`;
  // Runs waiting on an approval can sit for up to 30 days.
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Format an ISO date string as a short date in the viewer's own locale.
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format an ISO datetime to include time.
 */
export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get an ISO date string for N days ago.
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
