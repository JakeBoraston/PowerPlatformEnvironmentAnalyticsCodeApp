<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import { filterParam } from '$lib/utils/filterParam';
  import {
    connectionReferences, connectionReferencesLoading, connectionReferencesError,
    connectionReferenceCount, connectorUsage, orphanedConnectionReferences,
    unsolutionedConnectionReferences, directConnectionBindingCount,
    solutionsByReferenceId, flowsByReferenceLogicalName,
    fetchConnectionReferences, connectorIdFromPath, connectorLabel,
  } from '$lib/stores/connectionReferenceStore';
  import { workflowsLoading, workflowsError } from '$lib/stores/flowStore';
  import { solutionsLoading, solutionsError } from '$lib/stores/solutionStore';
  import { formatDate } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import ConnectionGraph from '$lib/components/charts/ConnectionGraph.svelte';
  import { Cable, Plug, Unlink, PackageOpen } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';

  let isLoading = $derived($connectionReferencesLoading || $workflowsLoading || $solutionsLoading);
  let error = $derived($connectionReferencesError);

  let searchQuery = $state('');
  let rowFilter = $state<'all' | 'orphaned' | 'unsolutioned'>(
    filterParam($querystring, 'show', ['all', 'orphaned', 'unsolutioned'] as const, 'all')
  );

  let orphanedIds = $derived(new Set($orphanedConnectionReferences.map((r) => r.connectionreferenceid)));
  let unsolutionedIds = $derived(new Set($unsolutionedConnectionReferences.map((r) => r.connectionreferenceid)));

  function solutionNames(refId: string): string {
    const list = $solutionsByReferenceId.get(refId.toLowerCase()) ?? [];
    return list.length ? list.map((s) => s.name).join(', ') : '';
  }

  function flowCountFor(logicalName: string | undefined): number {
    if (!logicalName) return 0;
    return $flowsByReferenceLogicalName.get(logicalName.toLowerCase())?.length ?? 0;
  }

  let filteredReferences = $derived(() => {
    const q = searchQuery.toLowerCase();
    return $connectionReferences
      .filter((ref) => {
        if (rowFilter === 'orphaned' && !orphanedIds.has(ref.connectionreferenceid)) return false;
        if (rowFilter === 'unsolutioned' && !unsolutionedIds.has(ref.connectionreferenceid)) return false;
        if (!q) return true;
        const display = (ref.connectionreferencedisplayname ?? '').toLowerCase();
        const logical = (ref.connectionreferencelogicalname ?? '').toLowerCase();
        const connector = connectorIdFromPath(ref.connectorid).toLowerCase();
        const solution = solutionNames(ref.connectionreferenceid).toLowerCase();
        return display.includes(q) || logical.includes(q) || connector.includes(q) || solution.includes(q);
      })
      .sort((a, b) =>
        (a.connectionreferencedisplayname ?? '').localeCompare(b.connectionreferencedisplayname ?? '')
      );
  });
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Connections"
    subtitle="Connection references, the solutions holding them, and the flows that bind them"
    refreshLabel="connection references"
    refreshing={isLoading}
    onRefresh={() => fetchConnectionReferences()}
  />

  <LoadError message={error} onRetry={() => fetchConnectionReferences()} />
  <LoadError message={$workflowsError} />
  <LoadError message={$solutionsError} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Connection References" value={$connectionReferenceCount} icon={Cable} />
      <KpiCard label="Connectors" value={$connectorUsage.length} icon={Plug} />
      <KpiCard label="Orphaned" value={$orphanedConnectionReferences.length} icon={Unlink} tone="warn" />
      <KpiCard label="Not In A Solution" value={$unsolutionedConnectionReferences.length} icon={PackageOpen} tone="warn" />
    </div>

    <ConnectionGraph />

    {#if $directConnectionBindingCount > 0}
      <div class="alert alert-info text-sm">
        <Plug size={16} />
        <span>
          {$directConnectionBindingCount} flow binding{$directConnectionBindingCount === 1 ? '' : 's'}
          name a connector but no connection reference, so {$directConnectionBindingCount === 1 ? 'it does' : 'they do'}
          not appear in the graph. These are typically older flows holding a direct connection.
        </span>
      </div>
    {/if}

    {#if $connectorUsage.length > 0}
      <div class="card bg-base-100 border border-base-300 p-4">
        <h3 class="font-semibold text-sm mb-3">Connector usage</h3>
        <div class="flex flex-col gap-2">
          {#each $connectorUsage.slice(0, 12) as connector (connector.id)}
            {@const max = $connectorUsage[0].flowCount || 1}
            {@const pct = Math.round((connector.flowCount / max) * 100)}
            <div class="flex items-center gap-3">
              <span class="text-sm w-48 shrink-0 truncate" title={connector.label}>{connector.label}</span>
              <div class="flex-1 h-2 bg-base-200 rounded-sm overflow-hidden">
                <div class="h-full bg-primary rounded-sm" style="width: {pct}%"></div>
              </div>
              <span class="text-xs font-mono w-32 text-right shrink-0">
                {connector.flowCount} flow{connector.flowCount === 1 ? '' : 's'}
                <span class="text-base-content/70">/ {connector.refCount} ref</span>
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search name, connector or solution…" bind:value={searchQuery} />
      <FilterSelect
        label="Show"
        options={[{ value: 'all', label: 'All references' }, { value: 'orphaned', label: 'Orphaned only' }, { value: 'unsolutioned', label: 'Not in a solution' }]}
        bind:value={rowFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">
        {filteredReferences().length} of {$connectionReferenceCount} references
      </span>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Connection references">
      <table class="table table-sm w-full">
        <thead>
          <tr>
            <th>Display Name</th>
            <th>Connector</th>
            <th>Solution</th>
            <th class="text-center">Flows</th>
            <th class="text-center">State</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredReferences() as ref (ref.connectionreferenceid)}
            {@const isOrphan = orphanedIds.has(ref.connectionreferenceid)}
            {@const solutionText = solutionNames(ref.connectionreferenceid)}
            {@const flows = flowCountFor(ref.connectionreferencelogicalname)}
            <tr class="hover:bg-base-200 transition-colors">
              <td class="font-medium">
                {ref.connectionreferencedisplayname}
                {#if isOrphan}
                  <span class="pa-pill pa-pill--warn ml-2">Orphaned</span>
                {/if}
              </td>
              <td class="text-sm">{connectorLabel(connectorIdFromPath(ref.connectorid))}</td>
              <td class="text-sm">
                {#if solutionText}
                  {solutionText}
                {:else}
                  <span class="pa-pill pa-pill--warn">None</span>
                {/if}
              </td>
              <td class="text-center text-xs font-mono">{flows || '—'}</td>
              <td class="text-center">
                <span class="pa-pill {ref.statecode === 0 ? 'pa-pill--ok' : 'pa-pill--idle'}">
                  {ref.statecode === 0 ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td class="text-xs text-base-content/70">
                {ref.createdon ? formatDate(ref.createdon) : '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
