<script lang="ts">
  import {
    envVarRows, envVarCount, unresolvedEnvVarCount,
    envVarsLoading, envVarsError, fetchEnvironmentVariables,
  } from '$lib/stores/environmentVariableStore';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import { Variable, TriangleAlert, PencilLine, Lock } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';

  let isLoading = $derived($envVarsLoading);
  let error = $derived($envVarsError);

  let searchQuery = $state('');
  let statusFilter = $state<'all' | 'unresolved' | 'overridden' | 'default'>('all');

  let overriddenCount = $derived($envVarRows.filter((r) => r.overridden).length);
  let managedCount = $derived($envVarRows.filter((r) => r.isManaged).length);

  function truncate(value: string | null, max = 60): string {
    if (value === null || value === '') return '—';
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }

  let filteredRows = $derived(() => {
    const q = searchQuery.toLowerCase();
    return $envVarRows.filter((row) => {
      if (statusFilter === 'unresolved' && !row.unresolved) return false;
      if (statusFilter === 'overridden' && !row.overridden) return false;
      if (statusFilter === 'default' && (row.overridden || row.unresolved)) return false;
      if (!q) return true;
      return (
        row.displayName.toLowerCase().includes(q) ||
        row.schemaName.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q)
      );
    });
  });
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Environment Variables"
    subtitle="Definitions and the values resolving in this environment"
    refreshLabel="environment variables"
    refreshing={isLoading}
    onRefresh={() => fetchEnvironmentVariables()}
  />

  <LoadError message={error} onRetry={() => fetchEnvironmentVariables()} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Definitions" value={$envVarCount} icon={Variable} />
      <KpiCard label="Unresolved" value={$unresolvedEnvVarCount} icon={TriangleAlert} tone="bad" />
      <KpiCard label="Overridden" value={overriddenCount} icon={PencilLine} />
      <KpiCard label="Managed" value={managedCount} icon={Lock} />
    </div>

    {#if $unresolvedEnvVarCount > 0}
      <div class="alert alert-error text-sm">
        <TriangleAlert size={16} />
        <span>
          {$unresolvedEnvVarCount} variable{$unresolvedEnvVarCount === 1 ? ' has' : 's have'}
          neither a value nor a default. Anything reading {$unresolvedEnvVarCount === 1 ? 'it' : 'them'}
          will fail at runtime, which is the usual reason a solution imports cleanly but does not work.
        </span>
      </div>
    {/if}

    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search name or description…" bind:value={searchQuery} />
      <FilterSelect
        label="Status"
        options={[{ value: 'all', label: 'All variables' }, { value: 'unresolved', label: 'Unresolved only' }, { value: 'overridden', label: 'Overridden only' }, { value: 'default', label: 'Using default' }]}
        bind:value={statusFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">
        {filteredRows().length} of {$envVarCount} variables
      </span>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Environment variables">
      <!-- Fixed layout: schema names and values are long unbroken strings (URLs,
           JSON, GUIDs) that would otherwise stretch the table past the page. -->
      <table class="table table-sm w-full table-fixed min-w-[720px]">
        <colgroup>
          <col class="w-[26%]" />
          <col class="w-[22%]" />
          <col class="w-[9%]" />
          <col class="w-[15%]" />
          <col class="w-[16%]" />
          <col class="w-[12%]" />
        </colgroup>
        <thead>
          <tr>
            <th>Display Name</th>
            <th>Schema Name</th>
            <th>Type</th>
            <th>Default</th>
            <th>Current Value</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredRows() as row (row.id)}
            <tr class="hover:bg-base-200 transition-colors">
              <td class="font-medium break-words">
                {row.displayName}
                {#if row.description}
                  <div class="text-xs text-base-content/70 font-normal">{truncate(row.description, 90)}</div>
                {/if}
              </td>
              <td class="text-xs font-mono text-base-content/70 break-all">{row.schemaName}</td>
              <td class="text-xs">{row.type}</td>
              <td class="text-xs font-mono text-base-content/70 break-all" title={row.defaultValue ?? ''}>{truncate(row.defaultValue)}</td>
              <td class="text-xs font-mono break-all" title={row.currentValue ?? ''}>{truncate(row.currentValue)}</td>
              <td class="text-center">
                {#if row.unresolved}
                  <span class="pa-pill pa-pill--bad">Unresolved</span>
                {:else if row.overridden}
                  <span class="pa-pill pa-pill--idle">Overridden</span>
                {:else}
                  <span class="pa-pill pa-pill--idle">Default</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
