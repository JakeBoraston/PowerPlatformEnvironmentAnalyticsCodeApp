<script lang="ts">
  import {
    solutionHistory, solutionHistoryLoading, solutionHistoryError,
    solutionHistoryCount, failedOperationCount, operationsBySolution,
    fetchSolutionHistory, solutionHistoryTruncated, operationLabel, subOperationLabel, statusLabel, isSuccess,
    isSolutionScoped,
  } from '$lib/stores/solutionHistoryStore';
  import { formatDate } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import { History, TriangleAlert, Package, CircleCheck } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';

  let isLoading = $derived($solutionHistoryLoading);
  let error = $derived($solutionHistoryError);

  let searchQuery = $state('');
  let resultFilter = $state<'all' | 'failed' | 'succeeded'>('all');

  let solutionsTouched = $derived($operationsBySolution.length);

  function durationLabel(seconds: number | undefined): string {
    if (seconds === undefined || seconds === null) return '—';
    const n = Number(seconds);
    if (isNaN(n)) return '—';
    if (n < 60) return `${n}s`;
    const mins = Math.floor(n / 60);
    const rem = n % 60;
    return rem === 0 ? `${mins}m` : `${mins}m ${rem}s`;
  }

  let filteredHistory = $derived(() => {
    const q = searchQuery.toLowerCase();
    return $solutionHistory.filter((row) => {
      const ok = isSuccess(row);
      if (resultFilter === 'failed' && ok) return false;
      if (resultFilter === 'succeeded' && !ok) return false;
      if (!q) return true;
      const name = (row.msdyn_name ?? '').toLowerCase();
      const publisher = (row.msdyn_publishername ?? '').toLowerCase();
      const version = (row.msdyn_solutionversion ?? '').toLowerCase();
      return name.includes(q) || publisher.includes(q) || version.includes(q);
    });
  });
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Solution History"
    subtitle={$solutionHistoryTruncated
      ? `The most recent ${$solutionHistoryCount.toLocaleString()} imports, exports, upgrades and publishes. Older operations are not included.`
      : 'Imports, exports, upgrades and publishes across this environment'}
    refreshLabel="solution history"
    refreshing={isLoading}
    onRefresh={() => fetchSolutionHistory()}
  />

  <LoadError message={error} onRetry={() => fetchSolutionHistory()} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Operations" value={$solutionHistoryCount} icon={History} />
      <KpiCard label="Failed" value={$failedOperationCount} icon={TriangleAlert} tone="bad" />
      <KpiCard
        label="Succeeded"
        value={$solutionHistoryCount - $failedOperationCount}
        icon={CircleCheck} tone="good"
      />
      <KpiCard label="Solutions Touched" value={solutionsTouched} icon={Package} />
    </div>

    {#if $operationsBySolution.length > 0}
      <div class="card bg-base-100 border border-base-300 p-4">
        <h3 class="font-semibold text-sm">Busiest solutions</h3>
        <p class="text-xs text-base-content/70 mb-3">
          Excludes environment-wide publishes, which aren't scoped to a solution
        </p>
        <div class="flex flex-col gap-2">
          {#each $operationsBySolution.slice(0, 10) as entry (entry.name)}
            {@const pct = Math.round((entry.total / $operationsBySolution[0].total) * 100)}
            <div class="flex items-center gap-3">
              <span class="text-sm w-56 shrink-0 truncate" title={entry.name}>{entry.name}</span>
              <div class="flex-1 h-2 bg-base-200 rounded-sm overflow-hidden flex">
                <div class="h-full bg-primary" style="width: {pct}%"></div>
              </div>
              <span class="text-xs font-mono w-24 text-right shrink-0">
                {entry.total}
                {#if entry.failed > 0}
                  <span class="pa-bad-text">({entry.failed} failed)</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search solution, publisher or version…" bind:value={searchQuery} />
      <FilterSelect
        label="Result"
        options={[{ value: 'all', label: 'All results' }, { value: 'failed', label: 'Failed only' }, { value: 'succeeded', label: 'Succeeded only' }]}
        bind:value={resultFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">
        {filteredHistory().length} of {$solutionHistoryCount} operations
      </span>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Solution operations">
      <table class="table table-sm w-full">
        <thead>
          <tr>
            <th>Solution</th>
            <th>Operation</th>
            <th>Version</th>
            <th>Publisher</th>
            <th class="text-center">Result</th>
            <th>Duration</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredHistory() as row (row.msdyn_solutionhistoryid)}
            {@const ok = isSuccess(row)}
            {@const sub = subOperationLabel(row.msdyn_suboperation as unknown as number)}
            {@const scoped = isSolutionScoped(row)}
            <tr class="hover:bg-base-200 transition-colors">
              <td class="font-medium">
                {#if scoped}
                  {row.msdyn_name || '—'}
                {:else}
                  <span class="text-base-content/70 font-normal">Environment-wide</span>
                {/if}
              </td>
              <td class="text-sm">
                {operationLabel(row.msdyn_operation as unknown as number)}
                {#if sub && sub !== 'None'}
                  <span class="text-xs text-base-content/70">· {sub}</span>
                {/if}
              </td>
              <td class="text-xs font-mono">{row.msdyn_solutionversion || '—'}</td>
              <td class="text-sm text-base-content/70">{row.msdyn_publishername || '—'}</td>
              <td class="text-center">
                <span class="pa-pill {ok ? 'pa-pill--ok' : 'pa-pill--bad'}" title={row.msdyn_exceptionmessage || ''}>
                  {ok ? 'Success' : 'Failed'}
                </span>
              </td>
              <td class="text-xs font-mono">{durationLabel(row.msdyn_totaltime as unknown as number)}</td>
              <td class="text-xs text-base-content/70">
                {row.msdyn_starttime ? formatDate(row.msdyn_starttime) : '—'}
                <span class="text-base-content/70">· {statusLabel(row.msdyn_status as unknown as number)}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
