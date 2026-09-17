import { get, type Readable } from 'svelte/store';
import { powerContextReady } from './powerContext';

/** Resolves once the Power Apps SDK has finished initialising. */
function whenContextReady(): Promise<void> {
  if (get(powerContextReady)) return Promise.resolve();

  return new Promise<void>((resolve) => {
    // We only get here when the store is currently false, so the synchronous
    // first emission can't resolve us and `unsub` is always assigned by the
    // time a truthy value arrives.
    const unsub = powerContextReady.subscribe((ready) => {
      if (ready) {
        resolve();
        queueMicrotask(() => unsub());
      }
    });
  });
}

/**
 * Wraps a store's fetch function so it runs at most once, and never before the
 * SDK is ready. Repeat calls return the same in-flight promise, so a route and
 * a hover prefetch racing each other only ever produce one request.
 *
 * The returned promise never rejects. Stores catch their own failures and write
 * them to their error store rather than throwing, so a failure is read from
 * `error` once the fetch settles. A failed load clears the cached promise, so
 * the next visit to the route retries instead of leaving the page empty.
 */
export function createLazyLoader(
  fetchFn: () => Promise<void>,
  error: Readable<string | null>,
): () => Promise<void> {
  let inFlight: Promise<void> | null = null;

  return function ensureLoaded(): Promise<void> {
    if (!inFlight) {
      const attempt: Promise<void> = whenContextReady()
        .then(() => fetchFn())
        .then(() => {
          if (get(error) && inFlight === attempt) inFlight = null;
        })
        .catch(() => {
          if (inFlight === attempt) inFlight = null;
        });
      inFlight = attempt;
    }
    return inFlight;
  };
}
