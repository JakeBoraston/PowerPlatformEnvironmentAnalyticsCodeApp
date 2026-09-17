<script lang="ts">
  import {
    solutions, solutionsLoading, solutionsError, solutionCount,
    managedSolutions, unmanagedSolutions, publisherCount,
    solutionsByPublisher, fetchSolutions,
    getPublisherName, isManaged
  } from '$lib/stores/solutionStore';
  import { formatDate } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import DonutChart from '$lib/components/charts/DonutChart.svelte';
  import OwnershipGraph from '$lib/components/charts/OwnershipGraph.svelte';
  import { Package, Lock, Unlock, Users } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';
  import SortHeader from '$lib/components/ui/SortHeader.svelte';


  let isLoading = $derived($solutionsLoading);

  let publisherSlices = $derived(
    [...$solutionsByPublisher.entries()].map(([label, value]) => ({ label, value }))
  );
  let error = $derived($solutionsError);

  // --- Filters ---
  let searchQuery = $state('');
  let managedFilter = $state<'all' | 'managed' | 'unmanaged'>('all');

  // --- Sort ---
  type SortField = 'name' | 'version' | 'publisher' | 'managed' | 'installed';
  let sortField = $state<SortField>('name');
  let sortAsc = $state(true);

  function toggleSort(field: SortField) {
    if (sortField === field) { sortAsc = !sortAsc; }
    else { sortField = field; sortAsc = true; }
  }


  let filteredSolutions = $derived(() => {
    let list = $solutions.filter((sol) => {
      const name = (sol.friendlyname ?? '').toLowerCase();
      const unique = (sol.uniquename ?? '').toLowerCase();
      const publisher = getPublisherName(sol).toLowerCase();
      const q = searchQuery.toLowerCase();
      if (q && !name.includes(q) && !unique.includes(q) && !publisher.includes(q)) return false;
      if (managedFilter === 'managed' && !isManaged(sol)) return false;
      if (managedFilter === 'unmanaged' && isManaged(sol)) return false;
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = (a.friendlyname ?? '').localeCompare(b.friendlyname ?? ''); break;
        case 'version': cmp = (a.version ?? '').localeCompare(b.version ?? ''); break;
        case 'publisher': cmp = getPublisherName(a).localeCompare(getPublisherName(b)); break;
        case 'managed': cmp = Number(isManaged(a)) - Number(isManaged(b)); break;
        case 'installed': cmp = new Date(a.installedon ?? '').getTime() - new Date(b.installedon ?? '').getTime(); break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  });

</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Solutions"
    subtitle="All solutions in this environment"
    refreshLabel="solutions"
    refreshing={isLoading}
    onRefresh={() => fetchSolutions()}
  />

  <LoadError message={error} onRetry={() => fetchSolutions()} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total" value={$solutionCount} icon={Package} />
      <KpiCard label="Managed" value={$managedSolutions.length} icon={Lock} />
      <KpiCard label="Unmanaged" value={$unmanagedSolutions.length} icon={Unlock} />
      <KpiCard label="Publishers" value={$publisherCount} icon={Users} />
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search name or publisher…" bind:value={searchQuery} />
      <FilterSelect
        label="Managed"
        options={[{ value: 'all', label: 'All' }, { value: 'managed', label: 'Managed only' }, { value: 'unmanaged', label: 'Unmanaged only' }]}
        bind:value={managedFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">{filteredSolutions().length} of {$solutionCount} solutions</span>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Solutions">
      <table class="table table-sm w-full">
        <thead>
          <tr>
            <SortHeader label="Solution Name" field="name" {sortField} {sortAsc} onsort={toggleSort} />
            <SortHeader label="Version" field="version" {sortField} {sortAsc} onsort={toggleSort} />
            <SortHeader label="Publisher" field="publisher" {sortField} {sortAsc} onsort={toggleSort} />
            <SortHeader label="Managed" field="managed" {sortField} {sortAsc} onsort={toggleSort} align="center" />
            <SortHeader label="Installed" field="installed" {sortField} {sortAsc} onsort={toggleSort} />
          </tr>
        </thead>
        <tbody>
          {#each filteredSolutions() as sol (sol.solutionid)}
            <tr class="hover:bg-base-200 transition-colors">
              <td class="font-medium">{sol.friendlyname}</td>
              <td class="text-xs font-mono">{sol.version}</td>
              <td class="text-sm">{getPublisherName(sol)}</td>
              <td class="text-center">
                <span class="pa-pill {isManaged(sol) ? 'pa-pill--idle' : 'pa-pill--idle'}">
                  {isManaged(sol) ? 'Managed' : 'Unmanaged'}
                </span>
              </td>
              <td class="text-xs text-base-content/70">
                {sol.installedon ? formatDate(sol.installedon) : '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <DonutChart
      title="Solutions by Publisher"
      data={publisherSlices}
      unit="solutions"
      categoryLabel="Publisher"
      maxSlices={10}
    />

    <!-- Ownership graph: lives here rather than on the dashboard, next to the
         solution inventory it describes. -->
    <OwnershipGraph />
  {/if}
</div>
