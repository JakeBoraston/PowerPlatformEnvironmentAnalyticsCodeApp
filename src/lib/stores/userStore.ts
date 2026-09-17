import { writable, derived } from 'svelte/store';
import { isTruthy } from '$lib/utils/dataverse';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { SystemusersService } from '@services/SystemusersService';
import type { Systemusers } from '@models/SystemusersModel';

// --- Raw data stores ---
export const users = writable<Systemusers[]>([]);
export const usersLoading = writable<boolean>(false);
export const usersError = writable<string | null>(null);

// --- Derived stores ---
export const userCount = derived(users, ($u) => $u.length);

export const activeUsers = derived(users, ($u) =>
  $u.filter((u) => !isTruthy(u.isdisabled))
);

export const disabledUsers = derived(users, ($u) =>
  $u.filter((u) => isTruthy(u.isdisabled))
);

/**
 * Lookup map: systemuserid → fullname.
 * Also indexes by azureactivedirectoryobjectid (AAD object ID)
 * so we can resolve canvas app owners (which use AAD IDs).
 */
export const userNameMap = derived(users, ($u) => {
  const map = new Map<string, string>();
  $u.forEach((u) => {
    const name = u.fullname ?? `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim();
    if (name) {
      if (u.systemuserid) map.set(u.systemuserid.toLowerCase(), name);
      if (u.azureactivedirectoryobjectid) map.set(u.azureactivedirectoryobjectid.toLowerCase(), name);
    }
  });
  return map;
});

/**
 * Resolve an owner display name from a record.
 * Tries owneridname first, then looks up the GUID in the user map.
 */
export function resolveOwnerName(
  record: { owneridname?: string; ownerid?: string; _owninguser_value?: string; aadcreatedbyid?: string; aadlastmodifiedbyid?: string },
  nameMap: Map<string, string>,
): string {
  // 1. If the SDK returned the display name directly, use it
  if (record.owneridname) return record.owneridname;

  // 2. Try looking up by owning user GUID
  if (record._owninguser_value) {
    const name = nameMap.get(record._owninguser_value.toLowerCase());
    if (name) return name;
  }

  // 3. Try looking up by owner ID (could be user or team)
  if (record.ownerid) {
    const name = nameMap.get(record.ownerid.toLowerCase());
    if (name) return name;
  }

  // 4. Try AAD object IDs (canvas apps use these)
  if ((record as any).aadcreatedbyid) {
    const name = nameMap.get((record as any).aadcreatedbyid.toLowerCase());
    if (name) return name;
  }
  if ((record as any).aadlastmodifiedbyid) {
    const name = nameMap.get((record as any).aadlastmodifiedbyid.toLowerCase());
    if (name) return name;
  }

  return '—';
}

/**
 * Fetch all environment users from Dataverse.
 */
export async function fetchUsers(): Promise<void> {
  usersLoading.set(true);
  usersError.set(null);

  try {
    const rows = await readAll((options) => SystemusersService.getAll(options), {
      orderBy: ['fullname asc'],
    }, 'users');

    users.set(rows);
  } catch (err) {
    usersError.set(describeLoadError(err, 'users'));
  } finally {
    usersLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureUsersLoaded = createLazyLoader(fetchUsers, usersError);
