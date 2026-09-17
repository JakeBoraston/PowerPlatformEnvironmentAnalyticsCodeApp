import { writable } from 'svelte/store';

/**
 * Number of days to show on the dashboard.
 * The flowrun elastic table retains a maximum of 28 days of data,
 * so the default and max option are capped at 28.
 */
export const dashboardTimeRange = writable<number>(28);

// A `timeRangeFilter` derived store used to live here. It built
// `startedon ge {date}`, but the flowrun column is `starttime`, so the filter
// would have thrown had anything consumed it. Nothing did. The real filter is
// built in flowSessionStore.fetchFlowRuns.

/** Selected flow ID for detail views (null = all flows). */
export const selectedFlowId = writable<string | null>(null);

/** Available time range options for the filter dropdown. */
export const timeRangeOptions = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 28, label: 'Last 28 days' },
];
