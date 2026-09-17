/**
 * Turns a failed Dataverse read into a message a maker can act on.
 *
 * The app is meant to drop into any environment, and the reads that fail there
 * are rarely bugs. They are a security role without read access, or a table
 * the environment does not have (Copilot Studio's tables only exist once it has
 * been provisioned). Raw SDK text says neither, so each store routes its
 * failure through here with a plain-language name for what it was loading.
 */

interface HttpLikeError {
  message?: string;
  status?: number;
}

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = Number((err as HttpLikeError).status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
}

function messageOf(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as HttpLikeError).message ?? '');
  }
  return '';
}

export function describeLoadError(err: unknown, what: string): string {
  const status = statusOf(err);
  const raw = messageOf(err);

  if (status === 401 || status === 403 || /forbidden|privilege|prv[A-Z]\w+|not authori[sz]ed|access denied/i.test(raw)) {
    return `Your security role can't read ${what} in this environment. Ask an environment admin for read access.`;
  }
  if (status === 404 || /does not exist|could not find|not found|resource not found for the segment/i.test(raw)) {
    return `This environment doesn't have the table behind ${what}, so there is nothing to show.`;
  }
  if (status === 429 || /too many requests|rate limit/i.test(raw)) {
    return `Dataverse is throttling requests. Wait a minute, then refresh ${what}.`;
  }
  if (status !== undefined && status >= 500) {
    return `Dataverse returned an error while loading ${what}. Try again shortly.`;
  }
  if (/failed to fetch|network|timeout|timed out/i.test(raw)) {
    return `Couldn't reach Dataverse to load ${what}. Check your connection, then refresh.`;
  }
  return raw ? `Couldn't load ${what}: ${raw}` : `Couldn't load ${what}.`;
}
