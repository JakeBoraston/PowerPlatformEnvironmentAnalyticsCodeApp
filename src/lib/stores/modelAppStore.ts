import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { AppmodulesService } from '@services/AppmodulesService';
import type { Appmodules } from '@models/AppmodulesModel';

// --- Raw data stores ---
export const modelApps = writable<Appmodules[]>([]);
export const modelAppsLoading = writable<boolean>(false);
export const modelAppsError = writable<string | null>(null);

// --- Derived stores ---
export const modelAppCount = derived(modelApps, ($apps) => $apps.length);

export const publishedModelApps = derived(modelApps, ($apps) =>
  $apps.filter((a) => a.statecode === 0)
);

export const draftModelApps = derived(modelApps, ($apps) =>
  $apps.filter((a) => a.statecode === 1)
);

/**
 * Fetch all model-driven apps from Dataverse.
 */
export async function fetchModelApps(): Promise<void> {
  modelAppsLoading.set(true);
  modelAppsError.set(null);

  try {
    const rows = await readAll((options) => AppmodulesService.getAll(options), {
      orderBy: ['name asc'],
    }, 'model-driven apps');

    modelApps.set(rows);
  } catch (err) {
    modelAppsError.set(describeLoadError(err, 'model-driven apps'));
  } finally {
    modelAppsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureModelAppsLoaded = createLazyLoader(fetchModelApps, modelAppsError);
