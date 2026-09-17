import type { IGetAllOptions } from '@models/CommonModels';

interface PageResult<T> {
  success: boolean;
  data: T[];
  error?: unknown;
  skipToken?: string;
}

export interface PagedRead<T> {
  rows: T[];
  /** True when the table held more matching rows than `limit`. */
  truncated: boolean;
}

// The SDK defaults to 500; Dataverse allows up to 5,000 per page. Virtual
// tables cap lower on the server, which paging handles anyway.
const PAGE_SIZE = 5000;

/**
 * Reads up to `limit` rows, following `skipToken` across pages.
 *
 * The SDK returns one page per call (500 rows unless told otherwise), and `top`
 * does not page for you: asking for 2,000 with a single call silently returns 500. Every
 * "most recent N" read goes through this so the count on screen is the count
 * that was asked for.
 */
export async function readPages<T>(
  getAll: (options?: IGetAllOptions) => Promise<PageResult<T>>,
  options: Omit<IGetAllOptions, 'top' | 'skipToken' | 'maxPageSize'>,
  limit: number,
  what: string,
): Promise<PagedRead<T>> {
  const rows: T[] = [];
  let skipToken: string | undefined;

  do {
    const result = await getAll({
      ...options,
      maxPageSize: PAGE_SIZE,
      ...(skipToken ? { skipToken } : {}),
    });
    if (!result.success) {
      throw result.error ?? new Error(`Failed to fetch ${what}`);
    }
    rows.push(...(result.data ?? []));
    skipToken = result.skipToken;
  } while (skipToken && rows.length < limit);

  return {
    rows: rows.slice(0, limit),
    truncated: rows.length > limit || Boolean(skipToken),
  };
}

/**
 * Upper bound for a whole-table read. Far above any environment this has met;
 * it exists so a runaway table cannot keep the page loading indefinitely.
 */
const WHOLE_TABLE_LIMIT = 100_000;

/** Reads every matching row, following pages. */
export async function readAll<T>(
  getAll: (options?: IGetAllOptions) => Promise<PageResult<T>>,
  options: Omit<IGetAllOptions, 'top' | 'skipToken' | 'maxPageSize'>,
  what: string,
): Promise<T[]> {
  const { rows } = await readPages(getAll, options, WHOLE_TABLE_LIMIT, what);
  return rows;
}
