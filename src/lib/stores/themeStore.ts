import { writable, derived, type Readable } from 'svelte/store';
import { applyChartMode } from '$lib/utils/chartTheme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'platform-analytics:theme';

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Storage can be blocked inside the Power Apps player; fall back quietly.
  }
  return 'system';
}

const systemQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

const systemMode = writable<ThemeMode>(systemQuery?.matches ? 'dark' : 'light');
systemQuery?.addEventListener('change', (e) => systemMode.set(e.matches ? 'dark' : 'light'));

/** What the viewer chose in Settings. Remembered per browser. */
export const themePreference = writable<ThemePreference>(readPreference());

themePreference.subscribe((value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Not persisted this session; the choice still applies until reload.
  }
});

/** The mode actually in force, with "system" resolved. */
export const themeMode: Readable<ThemeMode> = derived(
  [themePreference, systemMode],
  ([$preference, $system]) => ($preference === 'system' ? $system : $preference)
);

/**
 * Keeps the document and the chart palette in step with the mode. DaisyUI reads
 * `data-theme`; the charts read literal colours, which `applyChartMode` swaps
 * before any chart is redrawn.
 */
themeMode.subscribe((mode) => {
  applyChartMode(mode);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = mode;
  }
});

export const themeOptions = [
  { value: 'system', label: 'Match my device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;
