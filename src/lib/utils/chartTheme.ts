/**
 * Single source of truth for chart colour.
 *
 * LayerChart marks and the D3 graphs take these as literal values rather than
 * `var()` references. They follow the DaisyUI theme's hues, but every mark colour is
 * held to at least 3:1 against the card it sits on (WCAG 1.4.11), in both
 * light and dark mode. DaisyUI's own warning, info and accent fall short of
 * that on white, so those are deeper shades of the same hue.
 *
 * The rule that keeps charts coherent: a colour means the same thing everywhere.
 * Green is always success, red is always failure, and an entity type keeps its
 * colour whether it appears in the treemap, the ownership graph or a legend.
 *
 * The exported objects are swapped in place when the mode changes
 * (`applyChartMode`), and the routes remount, so every chart reads the palette
 * for the current mode when it next draws.
 */

export type ChartMode = 'light' | 'dark';

const palettes = {
  light: {
    theme: {
      primary: '#422ad5',
      secondary: '#f43098',
      accent: '#009e8a',
      neutral: '#1d232a',
      info: '#0591b3',
      success: '#00a96e',
      warning: '#b88300',
      error: '#ff5861',
    },
    chrome: {
      ink: '#1f2937',
      muted: '#6b7280',
      axis: '#d1d5db',
      split: '#e5e5e5',
      splitFaint: '#f3f4f6',
      surface: '#ffffff',
    },
    ramp: ['#eeecfb', '#cdc6f4', '#9b8fe8', '#422ad5', '#2a1c8f'],
    healthInk: { good: '#047857', degraded: '#946100', bad: '#c81e3a' },
  },
  dark: {
    theme: {
      primary: '#8b80f9',
      secondary: '#f43098',
      accent: '#2dd4bf',
      neutral: '#d1d5db',
      info: '#38bdf8',
      success: '#00a96e',
      warning: '#f5b000',
      error: '#ff5861',
    },
    chrome: {
      ink: '#e5e7eb',
      muted: '#9ca3af',
      axis: '#4b5563',
      split: '#374151',
      splitFaint: '#252b33',
      surface: '#1d232a',
    },
    // Dark to bright: on a dark card, more activity reads as more light.
    ramp: ['#262c45', '#3b3f86', '#5a55c9', '#8b80f9', '#c7c2ff'],
    healthInk: { good: '#34d399', degraded: '#fbbf24', bad: '#fb7185' },
  },
};

let mode: ChartMode = 'light';

/** Theme hues for the current mode. */
export const theme = { ...palettes.light.theme };

/** Chrome: axes, labels, gridlines, tooltips, node halos. */
export const chrome = { ...palettes.light.chrome };

/**
 * Run and job status. Fixed meanings, never reassigned per chart: green
 * succeeded, amber cancelled, red failed, grey for everything else.
 */
export const status = {
  succeeded: '',
  failed: '',
  cancelled: '',
  running: '',
  waiting: '',
  skipped: '',
  unknown: '',
};

/**
 * Platform entity types. Shared so an agent is the same colour in the treemap,
 * the ownership graph and anywhere else it appears.
 */
export const entity = {
  flow: '',
  canvasApp: '',
  modelApp: '',
  agent: '',
  solution: '',
  publisher: '',
  user: '',
  owner: '',
  connectionReference: '',
};

/**
 * Categorical series, in consumption order. Ordered so adjacent entries stay
 * distinguishable, with no repeats.
 */
export const series: string[] = [];

/**
 * Low-to-high ramp for heatmaps and calendars. Monotonic in lightness; a ramp
 * that isn't ordered stops meaning anything.
 */
export const ramp: string[] = [];

function derive() {
  Object.assign(status, {
    succeeded: theme.success,
    failed: theme.error,
    cancelled: theme.warning,
    // In progress is not a problem, so it stays neutral like everything else
    // that isn't success, attention or failure.
    running: chrome.muted,
    waiting: chrome.muted,
    skipped: chrome.muted,
    unknown: chrome.axis,
  });
  Object.assign(entity, {
    flow: theme.primary,
    canvasApp: theme.accent,
    modelApp: theme.success,
    agent: theme.secondary,
    solution: theme.error,
    publisher: theme.warning,
    user: theme.neutral,
    owner: theme.neutral,
    connectionReference: theme.primary,
  });
  series.splice(0, series.length,
    theme.primary, theme.error, theme.accent, theme.warning,
    theme.secondary, theme.success, theme.info, theme.neutral,
  );
  ramp.splice(0, ramp.length, ...palettes[mode].ramp);
}

derive();

/** Switches every exported palette to the given mode. */
export function applyChartMode(next: ChartMode): void {
  mode = next;
  Object.assign(theme, palettes[next].theme);
  Object.assign(chrome, palettes[next].chrome);
  derive();
}

export function currentChartMode(): ChartMode {
  return mode;
}

/** Series colour by index, wrapping when there are more items than colours. */
export function seriesColour(index: number): string {
  return series[index % series.length];
}

/** Health thresholds, so "good / degraded / bad" looks the same everywhere. */
export function healthColour(percent: number): string {
  if (percent >= 90) return theme.success;
  if (percent >= 70) return theme.warning;
  return theme.error;
}

/**
 * The same thresholds for text. Mark colours only need 3:1; a number set in
 * them needs 4.5:1, so these are shades of the same hues chosen for the mode.
 */
export function healthInk(percent: number): string {
  const ink = palettes[mode].healthInk;
  if (percent >= 90) return ink.good;
  if (percent >= 70) return ink.degraded;
  return ink.bad;
}
