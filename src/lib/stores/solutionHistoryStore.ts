import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readPages } from '$lib/utils/readPages';
import { Msdyn_solutionhistoriesService } from '@services/Msdyn_solutionhistoriesService';
import type { Msdyn_solutionhistories } from '@models/Msdyn_solutionhistoriesModel';

// --- Raw data stores ---
export const solutionHistory = writable<Msdyn_solutionhistories[]>([]);
export const solutionHistoryLoading = writable<boolean>(false);
export const solutionHistoryError = writable<string | null>(null);
/** True when there is more history than the most recent `SOLUTION_HISTORY_LIMIT` read. */
export const solutionHistoryTruncated = writable<boolean>(false);

// --- Label maps (mirrors the generated option sets) ---

const OPERATION_LABELS: Record<number, string> = {
  0: 'Import',
  1: 'Uninstall',
  2: 'Export',
  3: 'Publish',
  4: 'Publish all',
  5: 'Language provision',
  6: 'Import translation',
  7: 'Ribbon metadata',
  8: 'Workflow set state',
  9: 'None',
  10: 'Export lite',
  11: 'Updating missing packages',
};

const SUBOPERATION_LABELS: Record<number, string> = {
  0: 'None',
  1: 'New',
  2: 'Upgrade',
  3: 'Update',
  4: 'Delete',
  5: 'Inline upgrade',
  6: 'Waiting for missing packages',
  7: 'Installed missing packages',
  8: 'Failed installing missing packages',
};

const STATUS_LABELS: Record<number, string> = {
  0: 'Started',
  1: 'Completed',
  2: 'Queued',
};

export function operationLabel(value: number | undefined): string {
  if (value === undefined || value === null) return 'Unknown';
  return OPERATION_LABELS[value] ?? `Operation ${value}`;
}

export function subOperationLabel(value: number | undefined): string {
  if (value === undefined || value === null) return '';
  return SUBOPERATION_LABELS[value] ?? '';
}

export function statusLabel(value: number | undefined): string {
  if (value === undefined || value === null) return 'Unknown';
  return STATUS_LABELS[value] ?? `Status ${value}`;
}

/**
 * `msdyn_result` is the success flag. It comes back as a boolean, but the OData
 * layer has been seen to hand it over as the string 'True'/'False', so both are
 * treated as truthy forms here.
 */
export function isSuccess(record: Msdyn_solutionhistories): boolean {
  const raw = record.msdyn_result as unknown;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw.toLowerCase() === 'true';
  return false;
}

// --- Derived ---

export const solutionHistoryCount = derived(solutionHistory, ($h) => $h.length);

export const failedOperations = derived(solutionHistory, ($h) =>
  $h.filter((r) => !isSuccess(r))
);

export const failedOperationCount = derived(failedOperations, ($f) => $f.length);

/** Most recent operation per solution name. */
export const latestBySolution = derived(solutionHistory, ($h) => {
  const map = new Map<string, Msdyn_solutionhistories>();
  $h.forEach((r) => {
    const key = r.msdyn_name ?? 'Unknown';
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
      return;
    }
    const a = new Date(r.msdyn_starttime ?? '').getTime();
    const b = new Date(existing.msdyn_starttime ?? '').getTime();
    if (a > b) map.set(key, r);
  });
  return map;
});

/**
 * "Publish all customisations" is environment-wide, not solution-scoped. Dataverse
 * records it against the Default Solution with the operation name in the name
 * field, so it shows up as a solution called "PublishAll" — and easily as the
 * busiest one, since it runs on every publish. Matched on the operation code
 * rather than the name string, which is a display value.
 */
const OPERATION_PUBLISH_ALL = 4;

export function isSolutionScoped(record: Msdyn_solutionhistories): boolean {
  return (record.msdyn_operation as unknown as number) !== OPERATION_PUBLISH_ALL;
}

/** Operations that actually belong to a named solution. */
export const solutionScopedHistory = derived(solutionHistory, ($h) =>
  $h.filter(isSolutionScoped)
);

/** Operation counts, busiest solution first. Excludes environment-wide operations. */
export const operationsBySolution = derived(solutionScopedHistory, ($h) => {
  const counts = new Map<string, { name: string; total: number; failed: number }>();
  $h.forEach((r) => {
    const name = r.msdyn_name ?? 'Unknown';
    const entry = counts.get(name) ?? { name, total: 0, failed: 0 };
    entry.total++;
    if (!isSuccess(r)) entry.failed++;
    counts.set(name, entry);
  });
  return [...counts.values()].sort((a, b) => b.total - a.total);
});

export const SOLUTION_HISTORY_LIMIT = 2000;

/**
 * Fetch recent solution operations.
 *
 * `msdyn_solutionhistory` is a virtual table, so queries cap out at 1,000 records
 * per page and there is no change tracking. Newest-first with an explicit top
 * keeps this bounded rather than attempting to read the whole history.
 */
export async function fetchSolutionHistory(): Promise<void> {
  solutionHistoryLoading.set(true);
  solutionHistoryError.set(null);

  try {
    const { rows, truncated } = await readPages(
      (options) => Msdyn_solutionhistoriesService.getAll(options),
      {
        select: [
          'msdyn_solutionhistoryid',
          'msdyn_name',
          'msdyn_solutionid',
          'msdyn_starttime',
          'msdyn_endtime',
          'msdyn_totaltime',
          'msdyn_operation',
          'msdyn_suboperation',
          'msdyn_status',
          'msdyn_result',
          'msdyn_errorcode',
          'msdyn_exceptionmessage',
          'msdyn_publishername',
          'msdyn_solutionversion',
        ],
        orderBy: ['msdyn_starttime desc'],
      },
      SOLUTION_HISTORY_LIMIT,
      'solution history',
    );

    solutionHistory.set(rows);
    solutionHistoryTruncated.set(truncated);
  } catch (err) {
    solutionHistoryError.set(describeLoadError(err, 'solution history'));
  } finally {
    solutionHistoryLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureSolutionHistoryLoaded = createLazyLoader(fetchSolutionHistory, solutionHistoryError);
