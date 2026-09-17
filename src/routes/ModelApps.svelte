<script lang="ts">
  import {
    modelApps, modelAppsLoading, modelAppsError, modelAppCount,
    publishedModelApps, draftModelApps, fetchModelApps,
  } from '$lib/stores/modelAppStore';
  import { formatDate } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import { isTruthy } from '$lib/utils/dataverse';
  import { LayoutGrid, CheckCircle, FileEdit } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';

  let isLoading = $derived($modelAppsLoading);
  let error = $derived($modelAppsError);

  // --- Filters ---
  let searchQuery = $state('');
  let statusFilter = $state<'all' | 'published' | 'draft'>('all');

  let filteredApps = $derived(
    $modelApps.filter((app) => {
      const name = (app.name ?? '').toLowerCase();
      const unique = (app.uniquename ?? '').toLowerCase();
      const q = searchQuery.toLowerCase();
      if (q && !name.includes(q) && !unique.includes(q)) return false;
      if (statusFilter === 'published' && app.statecode !== 0) return false;
      if (statusFilter === 'draft' && app.statecode === 0) return false;
      return true;
    })
  );
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Model-Driven Apps"
    subtitle="All model-driven apps in this environment"
    refreshLabel="model-driven apps"
    refreshing={isLoading}
    onRefresh={() => fetchModelApps()}
  />

  <LoadError message={error} onRetry={() => fetchModelApps()} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard label="Total Apps" value={$modelAppCount} icon={LayoutGrid} />
      <KpiCard label="Published" value={$publishedModelApps.length} icon={CheckCircle} />
      <KpiCard label="Draft" value={$draftModelApps.length} icon={FileEdit} />
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search name…" bind:value={searchQuery} />
      <FilterSelect
        label="Status"
        options={[{ value: 'all', label: 'All statuses' }, { value: 'published', label: 'Published only' }, { value: 'draft', label: 'Draft only' }]}
        bind:value={statusFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">{filteredApps.length} of {$modelAppCount} apps</span>
    </div>

    {#if filteredApps.length === 0}
      <div class="text-center text-base-content/70 py-12">
        <p class="text-sm">No model-driven apps found.</p>
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Model-driven apps">
        <table class="table table-sm w-full">
          <thead>
            <tr>
              <th>App Name</th>
              <th>Unique Name</th>
              <th class="text-center">Status</th>
              <th class="text-center">Managed</th>
              <th>Modified</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredApps as app (app.appmoduleid)}
              <tr class="hover:bg-base-200 transition-colors">
                <td class="font-medium">{app.name}</td>
                <td class="text-xs text-base-content/70">{app.uniquename}</td>
                <td class="text-center">
                  <span class="pa-pill {app.statecode === 0 ? 'pa-pill--ok' : 'pa-pill--idle'}">
                    {app.statecodename ?? (app.statecode === 0 ? 'Published' : 'Draft')}
                  </span>
                </td>
                <td class="text-center">
                  <span class="pa-pill {isTruthy(app.ismanaged) ? 'pa-pill--idle' : 'pa-pill--idle'}">
                    {isTruthy(app.ismanaged) ? 'Managed' : 'Unmanaged'}
                  </span>
                </td>
                <td class="text-xs text-base-content/70">
                  {app.modifiedon ? formatDate(app.modifiedon) : '—'}
                </td>
                <td class="text-xs text-base-content/70">
                  {app.publishedon ? formatDate(app.publishedon) : '—'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
