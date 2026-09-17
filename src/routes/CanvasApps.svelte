<script lang="ts">
  import {
    canvasApps, canvasAppsLoading, canvasAppsError, canvasAppCount,
    publishedCanvasApps, staleCanvasApps, managedCanvasApps,
    unmanagedCanvasApps, canvasAppsByOwner, fetchCanvasApps, isSystemApp
  } from '$lib/stores/canvasAppStore';
  import { userNameMap, resolveOwnerName } from '$lib/stores/userStore';
  import { isTruthy } from '$lib/utils/dataverse';
  import { formatDate } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import DonutChart from '$lib/components/charts/DonutChart.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import { AppWindow, Upload, AlertTriangle, Lock, Unlock } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';


  let isLoading = $derived($canvasAppsLoading);
  let error = $derived($canvasAppsError);
  let nameMap = $derived($userNameMap);

  function ownerOf(app: any): string {
    return resolveOwnerName(app, nameMap);
  }

  // --- Filters ---
  let searchQuery = $state('');
  let managedFilter = $state<'all' | 'managed' | 'unmanaged'>('all');
  let typeFilter = $state<'all' | 'system' | 'custom'>('all');

  let filteredApps = $derived(
    $canvasApps.filter((app) => {
      const name = (app.displayname ?? app.name ?? '').toLowerCase();
      const owner = ownerOf(app).toLowerCase();
      const q = searchQuery.toLowerCase();
      if (q && !name.includes(q) && !owner.includes(q)) return false;
      if (managedFilter === 'managed' && !isTruthy(app.ismanaged)) return false;
      if (managedFilter === 'unmanaged' && isTruthy(app.ismanaged)) return false;
      if (typeFilter === 'system' && !isSystemApp(app)) return false;
      if (typeFilter === 'custom' && isSystemApp(app)) return false;
      return true;
    })
  );


  let ownerSlices = $derived(
    [...$canvasAppsByOwner.entries()].map(([label, value]) => ({ label, value }))
  );

  // --- Stale detail ---
  function isStale(app: any): boolean {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const modified = app.lastmodifiedtime ? new Date(app.lastmodifiedtime) : null;
    return !modified || modified < cutoff;
  }
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Canvas Apps"
    subtitle="All Canvas Apps in this environment"
    refreshLabel="canvas apps"
    refreshing={isLoading}
    onRefresh={() => fetchCanvasApps()}
  />

  <LoadError message={error} onRetry={() => fetchCanvasApps()} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" class="text-primary" />
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard label="Total Apps" value={$canvasAppCount} icon={AppWindow} />
      <KpiCard label="Published" value={$publishedCanvasApps.length} icon={Upload} />
      <KpiCard label="Managed" value={$managedCanvasApps.length} icon={Lock} />
      <KpiCard label="Unmanaged" value={$unmanagedCanvasApps.length} icon={Unlock} />
      <KpiCard
        label="Stale (90d)"
        value={$staleCanvasApps.length}
        icon={AlertTriangle}
        tone="warn"
        subtitle={$staleCanvasApps.length > 0
          ? $staleCanvasApps.slice(0, 3).map((a) => a.displayname ?? a.name).join(', ')
            + ($staleCanvasApps.length > 3 ? ` +${$staleCanvasApps.length - 3} more` : '')
          : ''}
      />
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search name or owner…" bind:value={searchQuery} />
      <FilterSelect
        label="Managed"
        options={[{ value: 'all', label: 'All' }, { value: 'managed', label: 'Managed only' }, { value: 'unmanaged', label: 'Unmanaged only' }]}
        bind:value={managedFilter}
      />
      <FilterSelect
        label="Origin"
        options={[{ value: 'all', label: 'All' }, { value: 'system', label: 'System / Microsoft' }, { value: 'custom', label: 'Custom' }]}
        bind:value={typeFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">{filteredApps.length} of {$canvasAppCount} apps</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="lg:col-span-2 overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Canvas apps">
        <table class="table table-sm w-full">
          <thead>
            <tr>
              <th>App Name</th>
              <th>Owner</th>
              <th>Last Published</th>
              <th class="text-center">Managed</th>
              <th class="text-center">Origin</th>
              <th class="text-center">Stale</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredApps as app (app.canvasappid)}
              <tr class="hover:bg-base-200 transition-colors">
                <td class="font-medium">{app.displayname ?? app.name}</td>
                <td class="text-sm">{ownerOf(app)}</td>
                <td class="text-xs text-base-content/70">
                  {app.lastpublishtime ? formatDate(app.lastpublishtime) : '—'}
                </td>
                <td class="text-center">
                  <Badge variant="neutral">
                    {isTruthy(app.ismanaged) ? 'Managed' : 'Unmanaged'}
                  </Badge>
                </td>
                <td class="text-center">
                  <Badge variant="neutral">
                    {isSystemApp(app) ? 'System' : 'Custom'}
                  </Badge>
                </td>
                <td class="text-center">
                  {#if isStale(app)}
                    <Badge variant="warning">Yes</Badge>
                  {:else}
                    <span class="text-xs text-base-content/70">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <DonutChart
        title="Apps by Owner"
        data={ownerSlices}
        unit="apps"
        categoryLabel="Owner"
        maxSlices={10}
      />
    </div>
  {/if}
</div>
