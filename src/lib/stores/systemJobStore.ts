import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readPages } from '$lib/utils/readPages';
import { AsyncoperationsService } from '@services/AsyncoperationsService';
import {
  Asyncoperationsoperationtype,
  Asyncoperationsstatuscode,
} from '@models/AsyncoperationsModel';
import type { Asyncoperations } from '@models/AsyncoperationsModel';

// --- Raw data stores ---
export const systemJobs = writable<Asyncoperations[]>([]);
export const systemJobsLoading = writable<boolean>(false);
export const systemJobsError = writable<string | null>(null);
/** True when there are more jobs than the most recent `SYSTEM_JOB_LIMIT` read. */
export const systemJobsTruncated = writable<boolean>(false);

// --- Status semantics ---
// statuscode: 30 = Succeeded, 31 = Failed, 32 = Canceled. Anything below 30 is
// still in flight (waiting / in progress / pausing).
const STATUS_SUCCEEDED = 30;
const STATUS_FAILED = 31;
const STATUS_CANCELED = 32;

function lookup(map: Record<number, string>, value: unknown, fallback: string): string {
  if (typeof value !== 'number') return fallback;
  return map[value] ?? `${fallback} ${value}`;
}

export function operationTypeLabel(value: unknown): string {
  return lookup(Asyncoperationsoperationtype as Record<number, string>, value, 'Type');
}

export function statusLabel(value: unknown): string {
  return lookup(Asyncoperationsstatuscode as Record<number, string>, value, 'Status');
}

export function isFailed(job: Asyncoperations): boolean {
  return (job.statuscode as unknown as number) === STATUS_FAILED;
}

export function isCanceled(job: Asyncoperations): boolean {
  return (job.statuscode as unknown as number) === STATUS_CANCELED;
}

export function isSucceeded(job: Asyncoperations): boolean {
  return (job.statuscode as unknown as number) === STATUS_SUCCEEDED;
}

export function isInFlight(job: Asyncoperations): boolean {
  const code = job.statuscode as unknown as number;
  return typeof code === 'number' && code < STATUS_SUCCEEDED;
}

// --- Derived ---

export const systemJobCount = derived(systemJobs, ($j) => $j.length);

export const failedSystemJobs = derived(systemJobs, ($j) => $j.filter(isFailed));
export const failedSystemJobCount = derived(failedSystemJobs, ($j) => $j.length);

export const inFlightSystemJobs = derived(systemJobs, ($j) => $j.filter(isInFlight));

/**
 * Share of finished jobs that succeeded, to one decimal place. Rounded down, so
 * any failure keeps it below 100% instead of rounding 498 of 500 up to a
 * perfect score next to a failure count.
 */
export const systemJobSuccessRate = derived(systemJobs, ($j) => {
  const finished = $j.filter((job) => !isInFlight(job));
  if (finished.length === 0) return 0;
  const ok = finished.filter(isSucceeded).length;
  return Math.floor((ok / finished.length) * 1000) / 10;
});

/** Job counts grouped by operation type, noisiest first. */
export const jobsByOperationType = derived(systemJobs, ($j) => {
  const counts = new Map<string, { label: string; total: number; failed: number }>();
  $j.forEach((job) => {
    const label = operationTypeLabel(job.operationtype);
    const entry = counts.get(label) ?? { label, total: 0, failed: 0 };
    entry.total++;
    if (isFailed(job)) entry.failed++;
    counts.set(label, entry);
  });
  return [...counts.values()].sort((a, b) => b.total - a.total);
});

/** Failed jobs, most recent first. */
export const recentFailedSystemJobs = derived(failedSystemJobs, ($failed) =>
  [...$failed].sort(
    (a, b) => new Date(b.createdon ?? '').getTime() - new Date(a.createdon ?? '').getTime()
  )
);

export const SYSTEM_JOB_LIMIT = 2000;

/**
 * Fetch recent system jobs.
 *
 * `asyncoperation` accumulates fast (rollup recalculation, index maintenance and
 * the like), so this reads the most recent slice rather than the whole table.
 */
export async function fetchSystemJobs(): Promise<void> {
  systemJobsLoading.set(true);
  systemJobsError.set(null);

  try {
    const { rows, truncated } = await readPages(
      (options) => AsyncoperationsService.getAll(options),
      {
        select: [
          'asyncoperationid',
          'name',
          'operationtype',
          'statecode',
          'statuscode',
          'message',
          'friendlymessage',
          'startedon',
          'completedon',
          'createdon',
          'primaryentitytype',
        ],
        orderBy: ['createdon desc'],
      },
      SYSTEM_JOB_LIMIT,
      'system jobs',
    );

    systemJobs.set(rows);
    systemJobsTruncated.set(truncated);
  } catch (err) {
    systemJobsError.set(describeLoadError(err, 'system jobs'));
  } finally {
    systemJobsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureSystemJobsLoaded = createLazyLoader(fetchSystemJobs, systemJobsError);
