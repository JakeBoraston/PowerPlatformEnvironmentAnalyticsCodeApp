import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { WorkflowsService } from '@services/WorkflowsService';
import type { Workflows } from '@models/WorkflowsModel';

// --- Raw data stores ---
export const workflows = writable<Workflows[]>([]);
export const workflowsLoading = writable<boolean>(false);
export const workflowsError = writable<string | null>(null);

// --- Derived stores ---
export const activeFlows = derived(workflows, ($wf) =>
  $wf.filter((w) => w.statecode === 1)
);

export const inactiveFlows = derived(workflows, ($wf) =>
  $wf.filter((w) => w.statecode !== 1)
);

export const flowCount = derived(workflows, ($wf) => $wf.length);
export const activeFlowCount = derived(activeFlows, ($af) => $af.length);

/** Lookup map: workflowid -> flow name */
export const flowNameMap = derived(workflows, ($wf) => {
  const map = new Map<string, string>();
  $wf.forEach((w) => map.set(w.workflowid, w.name));
  return map;
});

/**
 * Fetch all cloud flows (category eq 5) from Dataverse.
 */
export async function fetchWorkflows(): Promise<void> {
  workflowsLoading.set(true);
  workflowsError.set(null);

  try {
    const rows = await readAll((options) => WorkflowsService.getAll(options), {
      filter: 'category eq 5',
      orderBy: ['name asc'],
    }, 'cloud flows');

    workflows.set(rows);
  } catch (err) {
    workflowsError.set(describeLoadError(err, 'cloud flows'));
  } finally {
    workflowsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureWorkflowsLoaded = createLazyLoader(fetchWorkflows, workflowsError);
