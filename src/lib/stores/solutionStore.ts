import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { SolutionsService } from '@services/SolutionsService';
import type { Solutions } from '@models/SolutionsModel';
import { getFormattedValue, isTruthy } from '$lib/utils/dataverse';

// --- Raw data stores ---
export const solutions = writable<Solutions[]>([]);
export const solutionsLoading = writable<boolean>(false);
export const solutionsError = writable<string | null>(null);

// --- Helpers ---

/** Resolve publisher display name from OData annotations. */
export function getPublisherName(sol: any): string {
  return getFormattedValue(sol, '_publisherid_value') ?? '—';
}

/** Check if a solution is managed (handles both boolean and numeric). */
export function isManaged(sol: any): boolean {
  return isTruthy(sol.ismanaged);
}

// --- Derived stores ---
export const solutionCount = derived(solutions, ($s) => $s.length);

export const managedSolutions = derived(solutions, ($s) =>
  $s.filter((s) => isManaged(s))
);

export const unmanagedSolutions = derived(solutions, ($s) =>
  $s.filter((s) => !isManaged(s))
);

/** Unique publisher count. */
export const publisherCount = derived(solutions, ($s) => {
  const publishers = new Set<string>();
  $s.forEach((s) => {
    const name = getPublisherName(s);
    if (name !== '—') publishers.add(name);
  });
  return publishers.size;
});

/** Solutions grouped by publisher. */
export const solutionsByPublisher = derived(solutions, ($s) => {
  const map = new Map<string, number>();
  $s.forEach((s) => {
    const publisher = getPublisherName(s);
    map.set(publisher, (map.get(publisher) ?? 0) + 1);
  });
  return map;
});

/**
 * Fetch all visible solutions from Dataverse.
 */
export async function fetchSolutions(): Promise<void> {
  solutionsLoading.set(true);
  solutionsError.set(null);

  try {
    const rows = await readAll((options) => SolutionsService.getAll(options), {
      filter: 'isvisible eq true',
      orderBy: ['friendlyname asc'],
    }, 'solutions');

    solutions.set(rows);
  } catch (err) {
    solutionsError.set(describeLoadError(err, 'solutions'));
    console.error('[SolutionStore] Error:', err);
  } finally {
    solutionsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureSolutionsLoaded = createLazyLoader(fetchSolutions, solutionsError);
