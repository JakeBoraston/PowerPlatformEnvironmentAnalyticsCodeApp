import { writable, derived, get } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { dashboardTimeRange } from './dashboardFilters';
import { daysAgo } from '$lib/utils/dateUtils';
import { FlowrunsService } from '@services/FlowrunsService';
import type { Flowruns } from '@models/FlowrunsModel';

// --- Raw data stores ---
export const flowRuns = writable<Flowruns[]>([]);
export const flowRunsLoading = writable<boolean>(false);
export const flowRunsError = writable<string | null>(null);
/**
 * True when the run query stopped at the page cap with more rows still on the
 * server. A busy environment can exceed it inside 28 days, and every count on
 * the dashboard is then a floor rather than a total, so the UI says so.
 */
export const flowRunsCapped = writable<boolean>(false);

// --- Helpers ---

function isFailure(status: string | undefined): boolean {
  return status === 'Failed';
}

function isCancelled(status: string | undefined): boolean {
  return status === 'Cancelled';
}

function isUnsuccessful(status: string | undefined): boolean {
  return status === 'Failed' || status === 'Cancelled';
}

/**
 * A run's duration in seconds.
 *
 * `flowrun.duration` is stored in milliseconds: across real runs it is a
 * thousand times the gap between `starttime` and `endtime`. Every consumer
 * reads it through here, so nothing downstream handles milliseconds.
 */
function parseDuration(val: string | number | undefined): number {
  if (val === undefined || val === '') return 0;
  const ms = Number(val);
  return isNaN(ms) ? 0 : ms / 1000;
}

function getFlowId(run: Flowruns): string {
  return run.workflowid ?? 'unknown';
}

function getFlowName(run: Flowruns): string {
  return run.workflowid ?? 'Unknown';
}

// --- Derived analytics ---

export const totalRuns = derived(flowRuns, ($r) => $r.length);

export const succeededRuns = derived(flowRuns, ($r) =>
  $r.filter((r) => r.status === 'Succeeded')
);

export const failedRuns = derived(flowRuns, ($r) =>
  $r.filter((r) => isFailure(r.status))
);

export const cancelledRuns = derived(flowRuns, ($r) =>
  $r.filter((r) => isCancelled(r.status))
);

/** Failed + Cancelled combined (for the failures page). */
export const unsuccessfulRuns = derived(flowRuns, ($r) =>
  $r.filter((r) => isUnsuccessful(r.status))
);

export const runningRuns = derived(flowRuns, ($r) =>
  $r.filter((r) => r.status === 'Running' || r.status === 'Waiting')
);

export const successRate = derived(
  [flowRuns, succeededRuns],
  ([$all, $succeeded]) => {
    if ($all.length === 0) return 0;
    return Math.round(($succeeded.length / $all.length) * 100);
  }
);

/** A run longer than this was waiting on something, usually an approval. */
export const LONG_WAIT_SECONDS = 24 * 60 * 60;

/** Durations in seconds for the runs that recorded one. */
export function runDurations(runs: Flowruns[]): number[] {
  return runs.map((r) => parseDuration(r.duration)).filter((d) => d > 0);
}

/**
 * The typical run time. A median rather than a mean, because a handful of runs
 * left waiting for days on an approval would otherwise turn a ten-second flow
 * into an hour-long "average".
 */
export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median run time in seconds across the period. */
export const typicalDuration = derived(flowRuns, ($r) => medianOf(runDurations($r)));

/** Runs that took longer than a day, i.e. sat waiting rather than running. */
export const longWaitRunCount = derived(flowRuns, ($r) =>
  runDurations($r).filter((d) => d > LONG_WAIT_SECONDS).length
);

/** Flow runs grouped by workflow ID. */
export const runsByFlow = derived(flowRuns, ($r) => {
  const map = new Map<string, Flowruns[]>();
  $r.forEach((run) => {
    const flowId = getFlowId(run);
    const existing = map.get(flowId) ?? [];
    existing.push(run);
    map.set(flowId, existing);
  });
  return map;
});

/** Unique workflow IDs seen in run data. */
export const flowIdsInRuns = derived(flowRuns, ($r) => {
  const ids = new Set<string>();
  $r.forEach((run) => { if (run.workflowid) ids.add(run.workflowid); });
  return ids;
});

/** Unsuccessful runs (failed + cancelled) sorted by most recent first. */
export const recentFailures = derived(unsuccessfulRuns, ($unsuccessful) =>
  [...$unsuccessful].sort(
    (a, b) => new Date(b.starttime ?? '').getTime() - new Date(a.starttime ?? '').getTime()
  )
);

const MAX_PAGES = 20; // Safety cap
const PAGE_SIZE = 5000;

/** The most runs a single load will read. */
export const FLOW_RUN_LIMIT = MAX_PAGES * PAGE_SIZE;

/**
 * The time range the currently-held runs were fetched for. Lets the dashboard
 * refetch when the range changes without re-running on first mount, where the
 * route's lazy loader has already done the work.
 */
let loadedRange: number | null = null;

/**
 * Fetch all flow runs from the FlowRun elastic table, paginating
 * via skipToken until all records in the time range are loaded.
 */
export async function fetchFlowRuns(): Promise<void> {
  flowRunsLoading.set(true);
  flowRunsError.set(null);

  const range = get(dashboardTimeRange);
  const cutoff = daysAgo(range);
  const filterStr = `starttime ge ${cutoff}`;

  try {
    const allRuns: Flowruns[] = [];
    let skipToken: string | undefined;
    let page = 0;

    do {
      const result = await FlowrunsService.getAll({
        filter: filterStr,
        maxPageSize: PAGE_SIZE,
        ...(skipToken ? { skipToken } : {}),
      });

      if (!result.success) {
        throw result.error ?? new Error('Failed to fetch flow runs');
      }

      allRuns.push(...(result.data ?? []));
      skipToken = result.skipToken;
      page++;
    } while (skipToken && page < MAX_PAGES);

    flowRunsCapped.set(Boolean(skipToken));

    // Sort client-side by starttime desc
    allRuns.sort((a, b) =>
      new Date(b.starttime ?? '').getTime() - new Date(a.starttime ?? '').getTime()
    );

    flowRuns.set(allRuns);
    loadedRange = range;
  } catch (err) {
    flowRunsError.set(describeLoadError(err, 'flow runs'));
  } finally {
    flowRunsLoading.set(false);
  }
}

/**
 * Refetch only if the held data is for a different time range.
 *
 * The dashboard reacts to the range selector, but its effect also runs on mount,
 * where the route's lazy loader has already fetched. Without this guard, landing
 * on the dashboard fires the run query twice.
 */
export function ensureFlowRunsForRange(range: number): void {
  if (loadedRange !== null && loadedRange !== range) {
    void fetchFlowRuns();
  }
}

// Re-export helpers for components
export { isFailure, isCancelled, isUnsuccessful, parseDuration, getFlowId, getFlowName };

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureFlowRunsLoaded = createLazyLoader(fetchFlowRuns, flowRunsError);
