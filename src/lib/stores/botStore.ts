import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { BotsService } from '@services/BotsService';
import type { Bots } from '@models/BotsModel';

// --- Raw data stores ---
export const bots = writable<Bots[]>([]);
export const botsLoading = writable<boolean>(false);
export const botsError = writable<string | null>(null);

// --- Derived stores ---
export const botCount = derived(bots, ($b) => $b.length);

export const activeBots = derived(bots, ($b) =>
  $b.filter((b) => b.statecode === 0)
);

export const draftBots = derived(bots, ($b) =>
  $b.filter((b) => b.statecode !== 0)
);

/**
 * Fetch all Copilot Studio bots from Dataverse.
 */
export async function fetchBots(): Promise<void> {
  botsLoading.set(true);
  botsError.set(null);

  try {
    const rows = await readAll((options) => BotsService.getAll(options), {
      orderBy: ['name asc'],
    }, 'agents');

    bots.set(rows);
  } catch (err) {
    botsError.set(describeLoadError(err, 'agents'));
  } finally {
    botsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureBotsLoaded = createLazyLoader(fetchBots, botsError);
