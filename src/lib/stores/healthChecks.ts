import { derived, type Readable } from 'svelte/store';
import { workflows, workflowsError } from './flowStore';
import { flowRuns, runsByFlow, failedRuns, flowRunsError, isFailure } from './flowSessionStore';
import { canvasApps, canvasAppsError, staleCanvasApps, isSystemApp } from './canvasAppStore';
import { bots, botsError } from './botStore';
import { usersError, disabledOwnerIds, isOwnedByDisabledUser } from './userStore';
import {
  orphanedConnectionReferences,
  unsolutionedConnectionReferences,
  directConnectionBindingCount,
  connectionReferencesError,
} from './connectionReferenceStore';
import { unresolvedEnvVarCount, envVarsError } from './environmentVariableStore';
import { failedOperations, solutionHistoryError } from './solutionHistoryStore';
import { failedSystemJobCount, systemJobsError } from './systemJobStore';

export type CheckSeverity = 'critical' | 'attention' | 'housekeeping';
export type CheckGroup = 'Breaking now' | 'Risk and hygiene' | 'Housekeeping';

export interface HealthCheck {
  id: string;
  group: CheckGroup;
  severity: CheckSeverity;
  /** Reads as a finding when `count` is above zero. */
  title: string;
  /** What to do about it, in one line. */
  action: string;
  count: number;
  /** Wording for a clean result. */
  clear: string;
  /** Hash route holding the detail. */
  href: string;
  /** Set when the source failed to load, so a zero is not read as a pass. */
  unavailable: boolean;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Environment health as a list of checks, each with something to do about it.
 *
 * This replaced a radar of normalised scores (apps against a benchmark of 50,
 * solutions against 30) which looked precise and told nobody anything. Every
 * check here counts real records, and links to the page that lists them.
 */
export const healthChecks: Readable<HealthCheck[]> = derived(
  [
    workflows, workflowsError,
    flowRuns, runsByFlow, failedRuns, flowRunsError,
    canvasApps, canvasAppsError, staleCanvasApps,
    bots, botsError,
    disabledOwnerIds, usersError,
    orphanedConnectionReferences, unsolutionedConnectionReferences,
    directConnectionBindingCount, connectionReferencesError,
    unresolvedEnvVarCount, envVarsError,
    failedOperations, solutionHistoryError,
    failedSystemJobCount, systemJobsError,
  ],
  ([
    $workflows, $workflowsError,
    $flowRuns, $runsByFlow, $failedRuns, $flowRunsError,
    $canvasApps, $canvasAppsError, $staleCanvasApps,
    $bots, $botsError,
    $disabledOwnerIds, $usersError,
    $orphaned, $unsolutioned,
    $directBindings, $connectionReferencesError,
    $unresolvedEnvVars, $envVarsError,
    $failedOperations, $solutionHistoryError,
    $failedSystemJobs, $systemJobsError,
  ]) => {
    const activeFlows = $workflows.filter((flow) => flow.statecode === 1);

    // A deployment that failed a year ago is history, not a finding.
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentFailedOperations = $failedOperations.filter((row) => {
      const started = row.msdyn_starttime ? new Date(row.msdyn_starttime).getTime() : 0;
      return started >= thirtyDaysAgo;
    }).length;

    // A flow that ran and never once succeeded is broken, as opposed to simply
    // having had a bad run.
    const brokenFlows = activeFlows.filter((flow) => {
      const runs = $runsByFlow.get(flow.workflowid) ?? [];
      return runs.length > 0 && !runs.some((run) => run.status === 'Succeeded');
    });

    const flowsWithFailures = new Set(
      $flowRuns.filter((run) => isFailure(run.status)).map((run) => run.workflowid ?? '')
    );

    const idleFlows = activeFlows.filter(
      (flow) => ($runsByFlow.get(flow.workflowid) ?? []).length === 0
    );

    const ownedByDisabledUser = (record: { ownerid?: string; _owninguser_value?: string }) =>
      isOwnedByDisabledUser(record, $disabledOwnerIds);

    const orphanedFlows = $workflows.filter(ownedByDisabledUser).length;
    const orphanedApps = $canvasApps.filter(
      (app) => !isSystemApp(app) && ownedByDisabledUser(app as never)
    ).length;
    const orphanedAgents = $bots.filter((bot) => ownedByDisabledUser(bot as never)).length;

    const unpublishedAgents = $bots.filter((bot) => !bot.publishedon).length;
    const customStaleApps = $staleCanvasApps.filter((app) => !isSystemApp(app));

    const checks: HealthCheck[] = [
      {
        id: 'unresolved-env-vars',
        group: 'Breaking now',
        severity: 'critical',
        title: `${$unresolvedEnvVars} environment ${plural($unresolvedEnvVars, 'variable has', 'variables have')} no value`,
        action: 'Anything reading them fails at runtime. Set a value or a default.',
        count: $unresolvedEnvVars,
        clear: 'Every environment variable resolves',
        href: '/environment-variables?status=unresolved',
        unavailable: Boolean($envVarsError),
      },
      {
        id: 'broken-flows',
        group: 'Breaking now',
        severity: 'critical',
        title: `${brokenFlows.length} ${plural(brokenFlows.length, 'flow has', 'flows have')} not succeeded once`,
        action: 'Every run in this period failed or was cancelled. Start here.',
        count: brokenFlows.length,
        clear: 'Every flow that ran has succeeded at least once',
        href: '/failures?status=failed',
        unavailable: Boolean($flowRunsError || $workflowsError),
      },
      {
        id: 'failed-runs',
        group: 'Breaking now',
        severity: 'critical',
        title: `${$failedRuns.length} failed ${plural($failedRuns.length, 'run', 'runs')} across ${flowsWithFailures.size} ${plural(flowsWithFailures.size, 'flow', 'flows')}`,
        action: 'Read the error on each and fix or retire the flow.',
        count: $failedRuns.length,
        clear: 'No failed runs in this period',
        href: '/failures?status=failed',
        unavailable: Boolean($flowRunsError),
      },
      {
        id: 'failed-solution-operations',
        group: 'Breaking now',
        severity: 'critical',
        title: `${recentFailedOperations} solution ${plural(recentFailedOperations, 'operation', 'operations')} failed in the last 30 days`,
        action: 'An import, upgrade or publish did not land. Check the exception and run it again.',
        count: recentFailedOperations,
        clear: 'No solution operation has failed in the last 30 days',
        href: '/solution-history?result=failed',
        unavailable: Boolean($solutionHistoryError),
      },
      {
        id: 'failed-system-jobs',
        group: 'Breaking now',
        severity: 'critical',
        title: `${$failedSystemJobs} system ${plural($failedSystemJobs, 'job', 'jobs')} failed`,
        action: 'Background platform work is failing quietly. Read the job message.',
        count: $failedSystemJobs,
        clear: 'No failed system jobs',
        href: '/system-jobs?status=failed',
        unavailable: Boolean($systemJobsError),
      },
      {
        id: 'orphaned-connection-references',
        group: 'Risk and hygiene',
        severity: 'attention',
        title: `${$orphaned.length} connection ${plural($orphaned.length, 'reference is', 'references are')} unused`,
        action: 'No flow binds them. Delete them before they confuse the next deployment.',
        count: $orphaned.length,
        clear: 'Every connection reference is in use',
        href: '/connections?show=orphaned',
        unavailable: Boolean($connectionReferencesError),
      },
      {
        id: 'unsolutioned-connection-references',
        group: 'Risk and hygiene',
        severity: 'attention',
        title: `${$unsolutioned.length} connection ${plural($unsolutioned.length, 'reference sits', 'references sit')} outside a solution`,
        action: 'They will not travel with a deployment. Add them to the solution that uses them.',
        count: $unsolutioned.length,
        clear: 'Every connection reference belongs to a solution',
        href: '/connections?show=unsolutioned',
        unavailable: Boolean($connectionReferencesError),
      },
      {
        id: 'direct-connections',
        group: 'Risk and hygiene',
        severity: 'attention',
        title: `${$directBindings} flow ${plural($directBindings, 'binding uses', 'bindings use')} a connector directly`,
        action: 'These hold a connection rather than a connection reference, so they cannot be promoted cleanly. Rebuild them on a connection reference.',
        count: $directBindings,
        clear: 'Every flow binds through a connection reference',
        href: '/connections',
        unavailable: Boolean($connectionReferencesError || $workflowsError),
      },
      {
        id: 'disabled-owner-flows',
        group: 'Risk and hygiene',
        severity: 'attention',
        title: `${orphanedFlows} ${plural(orphanedFlows, 'flow is', 'flows are')} owned by a disabled user`,
        action: 'The owner has left. Reassign them before the account is deleted and they stop running.',
        count: orphanedFlows,
        clear: 'Every flow owner is an active user',
        href: '/flows?owner=disabled',
        unavailable: Boolean($usersError || $workflowsError),
      },
      {
        id: 'disabled-owner-apps',
        group: 'Risk and hygiene',
        severity: 'attention',
        title: `${orphanedApps} canvas ${plural(orphanedApps, 'app is', 'apps are')} owned by a disabled user`,
        action: 'The owner has left. Reassign them so the app stays editable.',
        count: orphanedApps,
        clear: 'Every canvas app owner is an active user',
        href: '/canvas-apps?owner=disabled',
        unavailable: Boolean($usersError || $canvasAppsError),
      },
      {
        id: 'disabled-owner-agents',
        group: 'Risk and hygiene',
        severity: 'attention',
        title: `${orphanedAgents} ${plural(orphanedAgents, 'agent is', 'agents are')} owned by a disabled user`,
        action: 'The owner has left. Reassign them so the agent stays maintainable.',
        count: orphanedAgents,
        clear: 'Every agent owner is an active user',
        href: '/agents?owner=disabled',
        unavailable: Boolean($usersError || $botsError),
      },
      {
        id: 'idle-flows',
        group: 'Housekeeping',
        severity: 'housekeeping',
        title: `${idleFlows.length} active ${plural(idleFlows.length, 'flow has', 'flows have')} not run`,
        action: 'On, but unused in this period. Candidates to turn off.',
        count: idleFlows.length,
        clear: 'Every active flow has run in this period',
        href: '/flows?runs=none',
        unavailable: Boolean($flowRunsError || $workflowsError),
      },
      {
        id: 'stale-canvas-apps',
        group: 'Housekeeping',
        severity: 'housekeeping',
        title: `${customStaleApps.length} canvas ${plural(customStaleApps.length, 'app has', 'apps have')} not changed in 90 days`,
        action: 'Retirement candidates, or apps nobody is maintaining.',
        count: customStaleApps.length,
        clear: 'Every canvas app has changed in the last 90 days',
        href: '/canvas-apps?stale=only',
        unavailable: Boolean($canvasAppsError),
      },
      {
        id: 'unpublished-agents',
        group: 'Housekeeping',
        severity: 'housekeeping',
        title: `${unpublishedAgents} ${plural(unpublishedAgents, 'agent has', 'agents have')} never been published`,
        action: 'Half-built agents sitting in the environment. Finish or remove them.',
        count: unpublishedAgents,
        clear: 'Every agent has been published',
        href: '/agents?status=unpublished',
        unavailable: Boolean($botsError),
      },
    ];

    return checks;
  }
);

/** Checks with something to act on, most severe first. */
export const healthFindings = derived(healthChecks, ($checks) => {
  const order: Record<CheckSeverity, number> = { critical: 0, attention: 1, housekeeping: 2 };
  return $checks
    .filter((check) => !check.unavailable && check.count > 0)
    .sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
});

export const healthPassedCount = derived(healthChecks, ($checks) =>
  $checks.filter((check) => !check.unavailable && check.count === 0).length
);

export const healthUnavailableCount = derived(healthChecks, ($checks) =>
  $checks.filter((check) => check.unavailable).length
);
