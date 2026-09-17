/**
 * Colour resolution for canvas consumers.
 *
 * DaisyUI 5 declares its theme in `oklch()`. ECharts renders to canvas and does
 * its own colour maths for things like emphasis and gradient stops, which can't
 * parse oklch — so everything funnels through `normaliseColour`, which lets the
 * browser resolve any CSS colour into a plain `rgb()` string.
 */

let probe: HTMLSpanElement | null = null;

/**
 * Resolves any CSS colour string — oklch, hsl, named, hex — to `rgb(r, g, b)`
 * by letting the browser do the conversion. Returns null when the value isn't a
 * colour the browser recognises.
 */
export function normaliseColour(value: string): string | null {
  if (typeof document === 'undefined') return null;
  const input = value.trim();
  if (!input) return null;

  if (!probe) {
    probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
  }

  // An unparseable value leaves the previous colour in place, so clear first and
  // treat "still empty" as a failure.
  probe.style.color = '';
  probe.style.color = input;
  if (!probe.style.color) return null;

  const resolved = getComputedStyle(probe).color;
  return resolved && resolved.startsWith('rgb') ? resolved : null;
}

/**
 * Reads a CSS custom property from :root and returns it as `rgb(r, g, b)`.
 * Falls back to the supplied value when the variable is missing or unparseable.
 */
export function cssColour(cssVarName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVarName);
  return normaliseColour(raw) ?? normaliseColour(fallback) ?? fallback;
}

/**
 * Same colour at a given alpha, for area fills under a line.
 */
export function withAlpha(colour: string, alpha: number): string {
  const resolved = normaliseColour(colour) ?? colour;
  const match = resolved.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!match) return resolved;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}
