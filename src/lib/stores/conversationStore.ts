import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { ConversationtranscriptsService } from '@services/ConversationtranscriptsService';
import type { Conversationtranscripts } from '@models/ConversationtranscriptsModel';
import { getFormattedValue } from '$lib/utils/dataverse';

// --- Raw data stores ---
export const conversations = writable<Conversationtranscripts[]>([]);
export const conversationsLoading = writable<boolean>(false);
export const conversationsError = writable<string | null>(null);

// --- Derived stores ---
export const conversationCount = derived(conversations, ($c) => $c.length);

/** Conversations grouped by bot ID. */
export const conversationsByBot = derived(conversations, ($c) => {
  const map = new Map<string, number>();
  $c.forEach((conv) => {
    const botId = (conv as any)._bot_conversationtranscriptid_value ?? 'unknown';
    map.set(botId, (map.get(botId) ?? 0) + 1);
  });
  return map;
});

/** Conversations over time (by date). */
export const conversationsByDate = derived(conversations, ($c) => {
  const map = new Map<string, number>();
  $c.forEach((conv) => {
    const date = conv.conversationstarttime?.substring(0, 10);
    if (date) map.set(date, (map.get(date) ?? 0) + 1);
  });
  return map;
});

/**
 * Fetch conversation transcripts from the last 28 days.
 * We only fetch metadata (no content field) to keep payloads small.
 */
export async function fetchConversations(): Promise<void> {
  conversationsLoading.set(true);
  conversationsError.set(null);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = cutoff.toISOString();

    const rows = await readAll((options) => ConversationtranscriptsService.getAll(options), {
      select: [
        'conversationtranscriptid', 'name', 'conversationstarttime',
        'schematype', 'createdon', 'statecode',
        '_bot_conversationtranscriptid_value',
      ],
      filter: `conversationstarttime ge ${cutoffStr}`,
    }, 'agent conversations');

    conversations.set(rows);
  } catch (err) {
    conversationsError.set(describeLoadError(err, 'agent conversations'));
  } finally {
    conversationsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureConversationsLoaded = createLazyLoader(fetchConversations, conversationsError);
