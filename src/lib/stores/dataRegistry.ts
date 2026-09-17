import { ensureWorkflowsLoaded } from './flowStore';
import { ensureFlowRunsLoaded } from './flowSessionStore';
import { ensureCanvasAppsLoaded } from './canvasAppStore';
import { ensureModelAppsLoaded } from './modelAppStore';
import { ensureSolutionsLoaded } from './solutionStore';
import { ensureBotsLoaded } from './botStore';
import { ensureBotComponentsLoaded } from './botComponentStore';
import { ensureConversationsLoaded } from './conversationStore';
import { ensureUsersLoaded } from './userStore';
import { ensureConnectionReferencesLoaded } from './connectionReferenceStore';
import { ensureSolutionHistoryLoaded } from './solutionHistoryStore';
import { ensureEnvironmentVariablesLoaded } from './environmentVariableStore';
import { ensureSystemJobsLoaded } from './systemJobStore';

type Loader = () => Promise<void>;

/**
 * What each route needs before it can render anything meaningful.
 *
 * Previously every store fetched itself the moment the SDK was ready, so opening
 * the app fired all nine queries in parallel regardless of where you landed.
 * Routes now declare their dependencies and the data is fetched on demand, with
 * a prefetch on nav hover so the wait is usually already over by the time the
 * route mounts.
 */
const routeData: Record<string, Loader[]> = {
  '/': [
    ensureWorkflowsLoaded,
    ensureFlowRunsLoaded,
    ensureCanvasAppsLoaded,
    ensureModelAppsLoaded,
    ensureSolutionsLoaded,
    ensureBotsLoaded,
    ensureUsersLoaded,
  ],
  '/flows': [ensureWorkflowsLoaded, ensureFlowRunsLoaded],
  '/flows/:id': [ensureWorkflowsLoaded, ensureFlowRunsLoaded],
  '/failures': [ensureWorkflowsLoaded, ensureFlowRunsLoaded],
  // Solutions are needed to name the owning-solution nodes in the graph.
  '/connections': [ensureConnectionReferencesLoaded, ensureWorkflowsLoaded, ensureSolutionsLoaded],
  '/canvas-apps': [ensureCanvasAppsLoaded, ensureUsersLoaded],
  '/model-apps': [ensureModelAppsLoaded],
  '/agents': [ensureBotsLoaded, ensureBotComponentsLoaded, ensureConversationsLoaded],
  '/agents/:id': [ensureBotsLoaded, ensureBotComponentsLoaded, ensureConversationsLoaded],
  // The ownership graph on this page spans flows, apps, agents and users, so the
  // route needs all of them, not just solutions.
  '/solutions': [
    ensureSolutionsLoaded,
    ensureWorkflowsLoaded,
    ensureCanvasAppsLoaded,
    ensureModelAppsLoaded,
    ensureBotsLoaded,
    ensureUsersLoaded,
  ],
  '/solution-history': [ensureSolutionHistoryLoaded],
  '/environment-variables': [ensureEnvironmentVariablesLoaded],
  '/system-jobs': [ensureSystemJobsLoaded],
  '/users': [ensureUsersLoaded],
  '/settings': [],
};

/** Matches `/flows/abc-123` to the `/flows/:id` key. */
function resolveRouteKey(path: string): string | undefined {
  if (routeData[path]) return path;

  const segments = path.split('/').filter(Boolean);
  return Object.keys(routeData).find((key) => {
    const keySegments = key.split('/').filter(Boolean);
    if (keySegments.length !== segments.length) return false;
    return keySegments.every((seg, i) => seg.startsWith(':') || seg === segments[i]);
  });
}

/**
 * Kick off every fetch a route needs. Safe to call repeatedly and from several
 * places at once — each loader de-duplicates internally, so a hover followed by
 * a click results in one request, not two.
 */
export function loadRouteData(path: string): Promise<void> {
  const key = resolveRouteKey(path);
  if (!key) return Promise.resolve();
  return Promise.all(routeData[key].map((load) => load())).then(() => undefined);
}

/**
 * Fire-and-forget variant for hover and focus. Deliberately returns nothing so a
 * caller can't accidentally await a prefetch and block an interaction.
 */
export function prefetchRoute(path: string): void {
  void loadRouteData(path);
}
