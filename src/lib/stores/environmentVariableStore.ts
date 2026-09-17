import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { EnvironmentvariabledefinitionsService } from '@services/EnvironmentvariabledefinitionsService';
import { EnvironmentvariablevaluesService } from '@services/EnvironmentvariablevaluesService';
import type { Environmentvariabledefinitions } from '@models/EnvironmentvariabledefinitionsModel';
import type { Environmentvariablevalues } from '@models/EnvironmentvariablevaluesModel';

// --- Raw data stores ---
export const envVarDefinitions = writable<Environmentvariabledefinitions[]>([]);
export const envVarValues = writable<Environmentvariablevalues[]>([]);
export const envVarsLoading = writable<boolean>(false);
export const envVarsError = writable<string | null>(null);

// --- Type labels (mirrors the generated option set) ---

const TYPE_LABELS: Record<number, string> = {
  100000000: 'String',
  100000001: 'Number',
  100000002: 'Boolean',
  100000003: 'JSON',
  100000004: 'Data source',
  100000005: 'Secret',
};

export function typeLabel(value: number | undefined): string {
  if (value === undefined || value === null) return 'Unknown';
  return TYPE_LABELS[value] ?? `Type ${value}`;
}

// --- Derived ---

/** Lookup: definition id -> current value record. */
export const valueByDefinitionId = derived(envVarValues, ($values) => {
  const map = new Map<string, Environmentvariablevalues>();
  $values.forEach((v) => {
    const defId = (v as unknown as Record<string, unknown>)['_environmentvariabledefinitionid_value'];
    if (typeof defId === 'string') map.set(defId.toLowerCase(), v);
  });
  return map;
});

export interface EnvVarRow {
  id: string;
  schemaName: string;
  displayName: string;
  description: string;
  type: string;
  defaultValue: string | null;
  currentValue: string | null;
  /** True when there is neither a current value nor a default to fall back on. */
  unresolved: boolean;
  /** True when a current value record exists, overriding the default. */
  overridden: boolean;
  isManaged: boolean;
}

/**
 * Definitions joined to their values.
 *
 * The distinction that matters on a deployment is `unresolved`: a definition with
 * no value record and no default will fail at runtime in the target environment,
 * and it is the single most common cause of a solution importing cleanly but not
 * working.
 */
export const envVarRows = derived(
  [envVarDefinitions, valueByDefinitionId],
  ([$defs, $valueById]): EnvVarRow[] =>
    $defs
      .map((def) => {
        const value = $valueById.get(def.environmentvariabledefinitionid.toLowerCase());
        const currentValue = value?.value ?? null;
        const defaultValue = def.defaultvalue ?? null;

        return {
          id: def.environmentvariabledefinitionid,
          schemaName: def.schemaname ?? '',
          displayName: def.displayname || def.schemaname || '(unnamed)',
          description: def.description ?? '',
          type: typeLabel(def.type as unknown as number),
          defaultValue,
          currentValue,
          unresolved: currentValue === null && (defaultValue === null || defaultValue === ''),
          overridden: currentValue !== null,
          isManaged: Boolean(def.ismanaged),
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
);

export const envVarCount = derived(envVarRows, ($rows) => $rows.length);

export const unresolvedEnvVars = derived(envVarRows, ($rows) => $rows.filter((r) => r.unresolved));

export const unresolvedEnvVarCount = derived(unresolvedEnvVars, ($rows) => $rows.length);

/**
 * Fetch definitions and values together. Both are small tables and the page is
 * meaningless with only one of them, so they load as a pair.
 */
export async function fetchEnvironmentVariables(): Promise<void> {
  envVarsLoading.set(true);
  envVarsError.set(null);

  try {
    const [definitions, values] = await Promise.all([
      readAll(
        (options) => EnvironmentvariabledefinitionsService.getAll(options),
        {
        select: [
          'environmentvariabledefinitionid',
          'schemaname',
          'displayname',
          'description',
          'type',
          'defaultvalue',
          'statecode',
          'ismanaged',
          'createdon',
        ],
        orderBy: ['displayname asc'],
      },
        'environment variable definitions',
      ),
      readAll(
        (options) => EnvironmentvariablevaluesService.getAll(options),
        {
        select: [
          'environmentvariablevalueid',
          'value',
          'statecode',
          'ismanaged',
          '_environmentvariabledefinitionid_value',
        ],
      },
        'environment variable values',
      ),
    ]);

    envVarDefinitions.set(definitions);
    envVarValues.set(values);
  } catch (err) {
    envVarsError.set(describeLoadError(err, 'environment variables'));
  } finally {
    envVarsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureEnvironmentVariablesLoaded = createLazyLoader(fetchEnvironmentVariables, envVarsError);
