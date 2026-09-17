import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { CanvasappsService } from '@services/CanvasappsService';
import type { Canvasapps } from '@models/CanvasappsModel';
import { userNameMap, resolveOwnerName } from './userStore';
import { isTruthy } from '$lib/utils/dataverse';

// --- Raw data stores ---
export const canvasApps = writable<Canvasapps[]>([]);
export const canvasAppsLoading = writable<boolean>(false);
export const canvasAppsError = writable<string | null>(null);

// --- Derived stores ---
export const canvasAppCount = derived(canvasApps, ($apps) => $apps.length);

export const publishedCanvasApps = derived(canvasApps, ($apps) =>
  $apps.filter((a) => a.lastpublishtime)
);

export const managedCanvasApps = derived(canvasApps, ($apps) =>
  $apps.filter((a) => isTruthy(a.ismanaged))
);

export const unmanagedCanvasApps = derived(canvasApps, ($apps) =>
  $apps.filter((a) => !isTruthy(a.ismanaged))
);

/** Apps not modified in the last 90 days (stale). */
export const staleCanvasApps = derived(canvasApps, ($apps) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  return $apps.filter((a) => {
    const modified = a.lastmodifiedtime ? new Date(a.lastmodifiedtime) : null;
    return !modified || modified < cutoff;
  });
});

/** Canvas apps grouped by owner (resolved via user lookup). */
export const canvasAppsByOwner = derived([canvasApps, userNameMap], ([$apps, $nameMap]) => {
  const map = new Map<string, number>();
  $apps.forEach((a) => {
    const owner = resolveOwnerName(a as any, $nameMap);
    map.set(owner, (map.get(owner) ?? 0) + 1);
  });
  return map;
});

/**
 * Heuristic: an app is "system" if it is managed and its publisher
 * looks like a Microsoft/system publisher.
 */
export function isSystemApp(app: Canvasapps): boolean {
  if (isTruthy(app.ismanaged)) return true;
  const pub = (app.publisher ?? '').toLowerCase();
  return pub.includes('microsoft') || pub.includes('system');
}

/**
 * Fetch all canvas apps from Dataverse.
 * Omitting `select` returns all fields — ensures lookup display names
 * (owneridname, ismanaged, publisher etc.) are included.
 */
export async function fetchCanvasApps(): Promise<void> {
  canvasAppsLoading.set(true);
  canvasAppsError.set(null);

  try {
    const rows = await readAll((options) => CanvasappsService.getAll(options), {
      orderBy: ['name asc'],
    }, 'canvas apps');

    canvasApps.set(rows);
  } catch (err) {
    canvasAppsError.set(describeLoadError(err, 'canvas apps'));
  } finally {
    canvasAppsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureCanvasAppsLoaded = createLazyLoader(fetchCanvasApps, canvasAppsError);
