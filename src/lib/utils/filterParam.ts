/**
 * Filters carried in the hash route's query string, e.g.
 * `#/failures?status=failed`.
 *
 * The dashboard's health findings link to the records behind them, not just to
 * the page holding them: "12 flows are owned by a disabled user" opens Flows
 * already filtered to those flows. Each page reads its own filter here.
 */
export function filterParam<T extends string>(
  querystring: string | undefined,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = new URLSearchParams(querystring ?? '').get(key);
  return allowed.includes(value as T) ? (value as T) : fallback;
}
