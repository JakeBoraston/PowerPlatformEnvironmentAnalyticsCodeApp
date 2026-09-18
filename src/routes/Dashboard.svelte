<script lang="ts">
  import {
    totalRuns, succeededRuns, failedRuns, cancelledRuns,
    typicalDuration, longWaitRunCount, flowRunsLoading, flowRunsError, flowRunsCapped,
    fetchFlowRuns, ensureFlowRunsForRange, FLOW_RUN_LIMIT,
  } from '$lib/stores/flowSessionStore';
  import { activeFlowCount, workflowsLoading, workflowsError, fetchWorkflows } from '$lib/stores/flowStore';
  import { canvasAppCount, canvasAppsLoading, canvasAppsError, fetchCanvasApps } from '$lib/stores/canvasAppStore';
  import { modelAppCount, modelAppsLoading, modelAppsError, fetchModelApps } from '$lib/stores/modelAppStore';
  import { solutionCount, solutionsLoading, solutionsError, fetchSolutions } from '$lib/stores/solutionStore';
  import { botCount, botsLoading, botsError, fetchBots } from '$lib/stores/botStore';
  import { activeUsers, usersLoading, usersError, fetchUsers } from '$lib/stores/userStore';
  import { connectionReferencesLoading, connectionReferencesError, fetchConnectionReferences } from '$lib/stores/connectionReferenceStore';
  import { envVarsLoading, envVarsError, fetchEnvironmentVariables } from '$lib/stores/environmentVariableStore';
  import { solutionHistoryLoading, solutionHistoryError, fetchSolutionHistory } from '$lib/stores/solutionHistoryStore';
  import { systemJobsLoading, systemJobsError, fetchSystemJobs } from '$lib/stores/systemJobStore';
  import { dashboardTimeRange } from '$lib/stores/dashboardFilters';
  import { formatDurationSeconds } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import TimeRangeSelect from '$lib/components/TimeRangeSelect.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import AboutPanel from '$lib/components/AboutPanel.svelte';

  // Flow charts
  import RunsOverTimeChart from '$lib/components/charts/RunsOverTimeChart.svelte';
  import SuccessRateChart from '$lib/components/charts/SuccessRateChart.svelte';
  import ActivityHeatmap from '$lib/components/charts/ActivityHeatmap.svelte';
  import OptimisationScatter from '$lib/components/charts/OptimisationScatter.svelte';
  import DurationChart from '$lib/components/charts/DurationChart.svelte';
  import RunsByStatusChart from '$lib/components/charts/RunsByStatusChart.svelte';
  import FailuresByFlowChart from '$lib/components/charts/FailuresByFlowChart.svelte';
  import WeeklyTrendChart from '$lib/components/charts/WeeklyTrendChart.svelte';

  // Platform charts
  import PlatformTreemap from '$lib/components/charts/PlatformTreemap.svelte';
  import EnvironmentHealth from '$lib/components/EnvironmentHealth.svelte';

  import {
    Activity, CheckCircle, XCircle, Ban, Clock, Workflow,
    AppWindow, LayoutGrid, Package, Bot, Users, TriangleAlert, Info,
  } from 'lucide-svelte';

  let isLoading = $derived($flowRunsLoading || $workflowsLoading);

  // The same sources the route loads (see dataRegistry), so the bar can finish.
  let sourceStates = $derived([
    $flowRunsLoading, $workflowsLoading, $canvasAppsLoading, $modelAppsLoading,
    $solutionsLoading, $botsLoading, $usersLoading,
    $connectionReferencesLoading, $envVarsLoading, $solutionHistoryLoading, $systemJobsLoading,
  ]);
  let totalSources = $derived(sourceStates.length);
  let loadedSources = $derived(sourceStates.filter((loading) => !loading).length);
  let loadProgress = $derived(Math.round((loadedSources / totalSources) * 100));

  /**
   * In an environment this app wasn't built in, a source can fail on its own:
   * no Copilot Studio tables, or a role that can't read users. Each failure is
   * listed so the rest of the page still reads as trustworthy, and its tile
   * shows a dash rather than a zero that looks like a real count.
   */
  let failures = $derived(
    [
      { name: 'Flow runs', error: $flowRunsError, retry: fetchFlowRuns },
      { name: 'Cloud flows', error: $workflowsError, retry: fetchWorkflows },
      { name: 'Canvas apps', error: $canvasAppsError, retry: fetchCanvasApps },
      { name: 'Model-driven apps', error: $modelAppsError, retry: fetchModelApps },
      { name: 'Solutions', error: $solutionsError, retry: fetchSolutions },
      { name: 'Agents', error: $botsError, retry: fetchBots },
      { name: 'Users', error: $usersError, retry: fetchUsers },
      { name: 'Connection references', error: $connectionReferencesError, retry: fetchConnectionReferences },
      { name: 'Environment variables', error: $envVarsError, retry: fetchEnvironmentVariables },
      { name: 'Solution history', error: $solutionHistoryError, retry: fetchSolutionHistory },
      { name: 'System jobs', error: $systemJobsError, retry: fetchSystemJobs },
    ].filter((source) => source.error)
  );

  function retryFailed() {
    failures.forEach((source) => source.retry());
  }

  function tile(loading: boolean, error: string | null, value: string | number): string | number {
    if (loading) return '…';
    return error ? '—' : value;
  }

  // Re-fetch when the time range changes. The initial load is handled by the
  // route's entry in dataRegistry, so this is a no-op on first mount.
  $effect(() => {
    ensureFlowRunsForRange($dashboardTimeRange);
  });
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Environment Analytics"
    subtitle="Power Platform environment overview"
    refreshLabel="flow runs"
    refreshing={isLoading}
    onRefresh={() => fetchFlowRuns()}
  >
    {#snippet actions()}
      <TimeRangeSelect />
    {/snippet}
  </PageHeader>

  <AboutPanel />

  {#if failures.length > 0}
    <div role="alert" class="alert alert-warning text-sm items-start">
      <TriangleAlert size={16} aria-hidden="true" class="mt-0.5" />
      <div class="flex flex-col gap-1">
        <p class="font-semibold">
          {failures.length === 1 ? 'One source' : `${failures.length} sources`} didn't load, so parts of this page are incomplete.
        </p>
        <ul class="list-disc pl-4 m-0">
          {#each failures as source (source.name)}
            <li><span class="font-medium">{source.name}:</span> {source.error}</li>
          {/each}
        </ul>
      </div>
      <button type="button" class="btn btn-sm" onclick={retryFailed}>Try again</button>
    </div>
  {/if}

  {#if $flowRunsCapped}
    <div role="status" class="alert alert-info text-sm">
      <Info size={16} aria-hidden="true" />
      <span>
        This environment has more than {FLOW_RUN_LIMIT.toLocaleString()} runs in the selected period.
        Only that many were loaded, so the run figures below are a minimum rather than a total. A shorter time range gives exact figures.
      </span>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-4">
        <Spinner size="lg" label="Loading dashboard" />
        <div class="w-48">
          <div class="flex justify-between text-xs text-base-content/70 mb-1">
            <span id="dashboard-progress-label">Loading data sources…</span>
            <span>{loadProgress}%</span>
          </div>
          <progress
            class="progress progress-primary w-full"
            value={loadProgress}
            max="100"
            aria-labelledby="dashboard-progress-label"
          ></progress>
          <p class="text-xs text-base-content/70 text-center mt-2">
            {loadedSources}/{totalSources} sources loaded
          </p>
        </div>
      </div>
    </div>
  {:else}
    <!-- ═══════════════════ PLATFORM OVERVIEW ═══════════════════ -->
    <div class="flex items-center gap-3 mt-2">
      <Package size={16} class="text-primary" aria-hidden="true" />
      <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider m-0">Platform Overview</h2>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard label="Canvas Apps" value={tile($canvasAppsLoading, $canvasAppsError, $canvasAppCount)} icon={AppWindow} />
      <KpiCard label="Model Apps" value={tile($modelAppsLoading, $modelAppsError, $modelAppCount)} icon={LayoutGrid} />
      <KpiCard label="Solutions" value={tile($solutionsLoading, $solutionsError, $solutionCount)} icon={Package} />
      <KpiCard label="Agents" value={tile($botsLoading, $botsError, $botCount)} icon={Bot} />
      <KpiCard label="Active Users" value={tile($usersLoading, $usersError, $activeUsers.length)} icon={Users} />
    </div>

    <EnvironmentHealth />

    <!-- ═══════════════════ FLOW ANALYTICS ═══════════════════ -->
    <div class="border-t border-base-300 pt-4 flex items-center gap-3 mt-2">
      <Workflow size={16} class="text-primary" aria-hidden="true" />
      <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider m-0">Flow Analytics</h2>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-6 gap-4">
      <KpiCard label="Total Runs" value={tile(false, $flowRunsError, $totalRuns)} icon={Activity} />
      <KpiCard label="Succeeded" value={tile(false, $flowRunsError, $succeededRuns.length)} icon={CheckCircle} tone="good" />
      <KpiCard label="Failed" value={tile(false, $flowRunsError, $failedRuns.length)} icon={XCircle} tone="bad" />
      <KpiCard label="Cancelled" value={tile(false, $flowRunsError, $cancelledRuns.length)} icon={Ban} tone="warn" />
      <KpiCard
        label="Typical Duration"
        value={tile(false, $flowRunsError, formatDurationSeconds($typicalDuration))}
        subtitle={$longWaitRunCount > 0 ? `Median run. ${$longWaitRunCount} waited over a day.` : 'Median run'}
        icon={Clock}
      />
      <KpiCard label="Active Flows" value={tile(false, $workflowsError, $activeFlowCount)} icon={Workflow} />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">
        <RunsOverTimeChart />
      </div>
      <SuccessRateChart />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">
        <ActivityHeatmap />
      </div>
      <RunsByStatusChart />
    </div>

    <WeeklyTrendChart />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <OptimisationScatter />
      <DurationChart />
      <FailuresByFlowChart />
    </div>

    <!-- ═══════════════════ PLATFORM INVENTORY ═══════════════════ -->
    <!-- The ownership graph moved to /solutions, where it sits alongside the
         solution inventory it describes. The treemap takes the full width. -->
    <div class="border-t border-base-300 pt-4 flex items-center gap-3 mt-2">
      <Package size={16} class="text-primary" aria-hidden="true" />
      <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider m-0">Platform Inventory</h2>
    </div>

    <PlatformTreemap />
  {/if}
</div>
