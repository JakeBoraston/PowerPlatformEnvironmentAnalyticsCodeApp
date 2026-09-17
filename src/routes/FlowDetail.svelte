<script lang="ts">
  import { workflows, workflowsLoading, workflowsError, fetchWorkflows } from '$lib/stores/flowStore';
  import {
    runsByFlow, parseDuration, isFailure, isCancelled,
    flowRunsLoading, flowRunsError, fetchFlowRuns,
  } from '$lib/stores/flowSessionStore';
  import { getFlowRunUrl, getFlowUrl } from '$lib/stores/powerContext';
  import { dashboardTimeRange } from '$lib/stores/dashboardFilters';
  import type { Flowruns } from '@models/FlowrunsModel';
  import { formatDate, formatDateTime, formatDurationSeconds } from '$lib/utils/dateUtils';
  import FlowRunTrendChart from '$lib/components/charts/FlowRunTrendChart.svelte';
  import ActivityHeatmap from '$lib/components/charts/ActivityHeatmap.svelte';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import { CheckCircle, XCircle, Ban, Clock, Activity } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import ExternalLinkButton from '$lib/components/ui/ExternalLinkButton.svelte';

  let { params = {} } = $props<{ params?: { id?: string } }>();

  let flowId = $derived(params.id ?? '');
  let flow = $derived($workflows.find((w) => w.workflowid === flowId));
  let runs = $derived($runsByFlow.get(flowId) ?? []);
  let days = $derived($dashboardTimeRange);
  let flowUrl = $derived(getFlowUrl(flowId));

  let totalCount = $derived(runs.length);
  let succeeded = $derived(runs.filter((r) => r.status === 'Succeeded').length);
  let failed = $derived(runs.filter((r) => isFailure(r.status)).length);
  let cancelled = $derived(runs.filter((r) => isCancelled(r.status)).length);
  let avgDuration = $derived(() => {
    const durations = runs.map((r) => parseDuration(r.duration)).filter((d) => d > 0);
    if (durations.length === 0) return 0;
    return Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
  });

  let activeTab = $state<'all' | 'succeeded' | 'failed' | 'cancelled'>('all');

  let filteredRuns = $derived(() => {
    const sorted = [...runs].sort((a, b) =>
      new Date(b.starttime ?? '').getTime() - new Date(a.starttime ?? '').getTime()
    );
    if (activeTab === 'succeeded') return sorted.filter((r) => r.status === 'Succeeded');
    if (activeTab === 'failed') return sorted.filter((r) => isFailure(r.status));
    if (activeTab === 'cancelled') return sorted.filter((r) => isCancelled(r.status));
    return sorted;
  });

  const tabs = [
    { id: 'all', label: 'All runs' },
    { id: 'succeeded', label: 'Succeeded' },
    { id: 'failed', label: 'Failed' },
    { id: 'cancelled', label: 'Cancelled' },
  ] as const;

  let isLoading = $derived($workflowsLoading || $flowRunsLoading);
  let error = $derived($workflowsError ?? $flowRunsError);

  let subtitle = $derived(
    [flow?.createdon ? `Created ${formatDate(flow.createdon)}` : '', flow?.description ?? '']
      .filter(Boolean)
      .join(' \u00b7 ')
  );

  function statusBadgeClass(status: string | undefined): string {
    if (status === 'Succeeded') return 'pa-pill--ok';
    if (status === 'Failed') return 'pa-pill--bad';
    if (status === 'Cancelled') return 'pa-pill--warn';
    return 'pa-pill--idle';
  }

  function buildRunUrl(run: any): string {
    return getFlowRunUrl(run.workflowid ?? '', run.name ?? '');
  }
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title={flow?.name ?? (isLoading ? 'Loading flow' : 'Flow not found')}
    {subtitle}
    backTo="/flows"
    backLabel="Back to cloud flows"
    refreshLabel="this flow's runs"
    refreshing={isLoading}
    onRefresh={() => { fetchWorkflows(); fetchFlowRuns(); }}
  >
    {#snippet actions()}
      <ExternalLinkButton href={flowUrl} label="Open this flow in Power Automate" text="Open in Power Automate" size="sm" variant="primary" />
    {/snippet}
  </PageHeader>

  <LoadError message={error} onRetry={() => { fetchWorkflows(); fetchFlowRuns(); }} />

  {#if isLoading && !flow}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading flow" />
    </div>
  {:else if !flow}
    <div class="pa-card text-sm">
      <p>No cloud flow with this ID exists in this environment. It may have been deleted, or the link came from another environment.</p>
      <a href="#/flows" class="link mt-2 inline-block">View all cloud flows</a>
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard label="Total Runs" value={totalCount} icon={Activity} />
      <KpiCard label="Succeeded" value={succeeded} icon={CheckCircle} tone="good" />
      <KpiCard label="Failed" value={failed} icon={XCircle} tone="bad" />
      <KpiCard label="Cancelled" value={cancelled} icon={Ban} tone="warn" />
      <KpiCard label="Avg Duration" value={formatDurationSeconds(avgDuration())} icon={Clock} />
    </div>

    <FlowRunTrendChart {runs} flowName={flow.name ?? 'Flow'} {days} />

    <ActivityHeatmap {runs} title="When This Flow Runs: Day & Hour" />

    <section aria-labelledby="run-history-heading">
      <h2 id="run-history-heading" class="pa-h3 text-sm font-bold uppercase tracking-wider mb-3">Run history</h2>
      <div class="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter runs by result">
        {#each tabs as tab (tab.id)}
          <button type="button" class="pa-chip" aria-pressed={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>
            {tab.label}
          </button>
        {/each}
      </div>

      {#if filteredRuns().length === 0}
        <p class="text-sm text-base-content/70 text-center py-8">No runs in this period.</p>
      {:else}
        {#if filteredRuns().length > 100}
          <p class="text-xs text-base-content/70 mb-2">Showing the 100 most recent of {filteredRuns().length} runs.</p>
        {/if}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Run history">
          <table class="table table-sm w-full">
            <thead class="sticky top-0 bg-base-100">
              <tr>
                <th>Started</th>
                <th>Ended</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Trigger</th>
                <th>Error</th>
                <th><span class="sr-only">Link</span></th>
              </tr>
            </thead>
            <tbody>
              {#each filteredRuns().slice(0, 100) as run (run.flowrunid)}
                {@const runUrl = buildRunUrl(run)}
                <tr class="hover:bg-base-200 transition-colors">
                  <td class="text-xs whitespace-nowrap">{run.starttime ? formatDateTime(run.starttime) : '—'}</td>
                  <td class="text-xs whitespace-nowrap">{run.endtime ? formatDateTime(run.endtime) : '—'}</td>
                  <td>
                    <span class="pa-pill {statusBadgeClass(run.status)}">
                      {run.status ?? 'Unknown'}
                    </span>
                  </td>
                  <td class="text-xs">{run.duration ? formatDurationSeconds(parseDuration(run.duration)) : '—'}</td>
                  <td class="text-xs">{run.triggertype ?? '—'}</td>
                  <td class="text-xs max-w-[240px] truncate" title={run.errormessage ?? ''}>
                    {#if run.errormessage}
                      <span class="pa-bad-text">{run.errormessage}</span>
                    {:else}
                      —
                    {/if}
                  </td>
                  <td>
                    <ExternalLinkButton href={runUrl} label="View this run in Power Automate" />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</div>
