<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import { filterParam } from '$lib/utils/filterParam';
  import {
    workflows, workflowsLoading, workflowsError, fetchWorkflows,
    flowCount, activeFlowCount,
  } from '$lib/stores/flowStore';
  import { userNameMap, resolveOwnerName, disabledOwnerIds, isOwnedByDisabledUser } from '$lib/stores/userStore';
  import FlowsTable from '$lib/components/FlowsTable.svelte';
  import TimeRangeSelect from '$lib/components/TimeRangeSelect.svelte';
  import { fetchFlowRuns, flowRunsLoading, runsByFlow } from '$lib/stores/flowSessionStore';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';

  let isLoading = $derived($workflowsLoading);
  let error = $derived($workflowsError);
  let nameMap = $derived($userNameMap);

  // --- Filters ---
  let searchQuery = $state('');
  let stateFilter = $state<'all' | 'active' | 'inactive'>(
    filterParam($querystring, 'state', ['all', 'active', 'inactive'] as const, 'all')
  );
  let ownerFilter = $state<'all' | 'disabled'>(
    filterParam($querystring, 'owner', ['all', 'disabled'] as const, 'all')
  );
  let runsFilter = $state<'all' | 'none'>(
    filterParam($querystring, 'runs', ['all', 'none'] as const, 'all')
  );

  let filteredFlows = $derived(
    $workflows.filter((flow) => {
      const name = (flow.name ?? '').toLowerCase();
      const owner = resolveOwnerName(flow as any, nameMap).toLowerCase();
      const q = searchQuery.toLowerCase();
      if (q && !name.includes(q) && !owner.includes(q)) return false;
      if (stateFilter === 'active' && flow.statecode !== 1) return false;
      if (stateFilter === 'inactive' && flow.statecode === 1) return false;
      if (ownerFilter === 'disabled' && !isOwnedByDisabledUser(flow as never, $disabledOwnerIds)) return false;
      if (runsFilter === 'none' && ($runsByFlow.get(flow.workflowid) ?? []).length > 0) return false;
      return true;
    })
  );
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Cloud Flows"
    subtitle="All Power Automate cloud flows in this environment"
    refreshLabel="flows and their runs"
    refreshing={isLoading || $flowRunsLoading}
    onRefresh={() => { fetchWorkflows(); fetchFlowRuns(); }}
  >
    {#snippet actions()}
      <TimeRangeSelect label="Run stats period" />
    {/snippet}
  </PageHeader>

  <LoadError message={error} onRetry={() => { fetchWorkflows(); fetchFlowRuns(); }} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search name or owner…" bind:value={searchQuery} />
      <FilterSelect
        label="State"
        options={[{ value: 'all', label: 'All states' }, { value: 'active', label: 'Active only' }, { value: 'inactive', label: 'Inactive only' }]}
        bind:value={stateFilter}
      />
      <FilterSelect
        label="Owner"
        options={[{ value: 'all', label: 'All owners' }, { value: 'disabled', label: 'Disabled owners' }]}
        bind:value={ownerFilter}
      />
      <FilterSelect
        label="Runs"
        options={[{ value: 'all', label: 'Any' }, { value: 'none', label: 'No runs in period' }]}
        bind:value={runsFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">{filteredFlows.length} of {$flowCount} flows ({$activeFlowCount} active)</span>
    </div>

    <FlowsTable flows={filteredFlows} />
  {/if}
</div>
