<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import { filterParam } from '$lib/utils/filterParam';
  import { recentFailures, parseDuration, getFlowId } from '$lib/stores/flowSessionStore';
  import { flowNameMap } from '$lib/stores/flowStore';
  import { getFlowRunUrl } from '$lib/stores/powerContext';
  import { formatDateTime, formatDurationSeconds } from '$lib/utils/dateUtils';
  import ExternalLinkButton from '$lib/components/ui/ExternalLinkButton.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';
  import SortHeader from '$lib/components/ui/SortHeader.svelte';

  let failures = $derived($recentFailures);
  let nameMap = $derived($flowNameMap);

  let selectedError = $state<{ name: string; message: string; runUrl: string } | null>(null);
  let dialogEl: HTMLDialogElement;

  // --- Filters ---
  // The dashboard links here with a filter, e.g. #/failures?status=failed
  let statusFilter = $state<'all' | 'failed' | 'cancelled'>(
    filterParam($querystring, 'status', ['all', 'failed', 'cancelled'] as const, 'failed')
  );
  let searchQuery = $state('');

  let filteredFailures = $derived(() => {
    return failures.filter((run) => {
      if (statusFilter === 'failed' && run.status !== 'Failed') return false;
      if (statusFilter === 'cancelled' && run.status !== 'Cancelled') return false;
      if (searchQuery) {
        const name = (nameMap.get(getFlowId(run)) ?? run.name ?? '').toLowerCase();
        if (!name.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  });

  // --- Sort ---
  let sortField = $state<'flow' | 'status' | 'started' | 'duration'>('started');
  let sortAsc = $state(false);

  let sortedFailures = $derived(() => {
    const list = [...filteredFailures()];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'flow': {
          const nameA = nameMap.get(getFlowId(a)) ?? a.name ?? '';
          const nameB = nameMap.get(getFlowId(b)) ?? b.name ?? '';
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case 'status':
          cmp = (a.status ?? '').localeCompare(b.status ?? '');
          break;
        case 'started':
          cmp = new Date(a.starttime ?? '').getTime() - new Date(b.starttime ?? '').getTime();
          break;
        case 'duration':
          cmp = parseDuration(a.duration) - parseDuration(b.duration);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  });

  function toggleSort(field: typeof sortField) {
    if (sortField === field) { sortAsc = !sortAsc; }
    else { sortField = field; sortAsc = true; }
  }


  function buildRunUrl(run: any): string {
    return getFlowRunUrl(run.workflowid ?? '', run.name ?? '');
  }

  function parseErrorMessage(raw: string): string {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.error?.message) return parsed.error.message;
      if (parsed.message) return parsed.message;
      return raw;
    } catch {
      return raw;
    }
  }

  function showError(flowName: string, rawMessage: string, runUrl: string) {
    selectedError = { name: flowName, message: rawMessage, runUrl };
    dialogEl?.showModal();
  }

  function statusBadgeClass(status: string): string {
    if (status === 'Failed') return 'pa-pill--bad';
    if (status === 'Cancelled') return 'pa-pill--warn';
    return 'pa-pill--idle';
  }
</script>

<!-- Filters -->
<div class="flex flex-wrap items-end gap-3 mb-4">
  <SearchField placeholder="Search flow name…" bind:value={searchQuery} />
  <FilterSelect
    label="Status"
    options={[{ value: 'failed', label: 'Failed only' }, { value: 'cancelled', label: 'Cancelled only' }, { value: 'all', label: 'All unsuccessful' }]}
    bind:value={statusFilter}
  />
  <span class="text-xs text-base-content/70 pb-2" aria-live="polite">{filteredFailures().length} runs</span>
</div>

{#if filteredFailures().length === 0}
  <div class="text-center text-base-content/70 py-12">
    <p class="text-sm">No {statusFilter === 'all' ? 'unsuccessful' : statusFilter} runs in this period{searchQuery ? ' match that search' : ''}.</p>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Unsuccessful runs">
    <table class="table table-sm w-full">
      <thead>
        <tr>
          <SortHeader label="Flow" field="flow" {sortField} {sortAsc} onsort={toggleSort} />
          <SortHeader label="Status" field="status" {sortField} {sortAsc} onsort={toggleSort} />
          <SortHeader label="Started" field="started" {sortField} {sortAsc} onsort={toggleSort} />
          <SortHeader label="Duration" field="duration" {sortField} {sortAsc} onsort={toggleSort} />
          <th>Error</th>
          <th><span class="sr-only">Open in Power Automate</span></th>
        </tr>
      </thead>
      <tbody>
        {#each sortedFailures() as run (run.flowrunid)}
          {@const flowName = nameMap.get(getFlowId(run)) ?? run.name ?? 'Unknown'}
          {@const runUrl = buildRunUrl(run)}
          <tr class="hover:bg-base-200 transition-colors">
            <td class="font-medium max-w-[200px] truncate">{flowName}</td>
            <td>
              <span class="pa-pill {statusBadgeClass(run.status ?? '')}">{run.status}</span>
            </td>
            <td class="text-xs">{run.starttime ? formatDateTime(run.starttime) : '—'}</td>
            <td class="text-xs">
              {run.duration ? formatDurationSeconds(parseDuration(run.duration)) : '—'}
            </td>
            <td>
              {#if run.errormessage}
                <button
                  type="button"
                  class="btn btn-xs btn-ghost"
                  aria-haspopup="dialog"
                  onclick={() => showError(flowName, run.errormessage ?? '', runUrl)}
                >
                  View error<span class="sr-only"> for {flowName}</span>
                </button>
              {:else}
                <span class="text-xs text-base-content/70">None</span>
              {/if}
            </td>
            <td>
              <ExternalLinkButton href={runUrl} label="View this run of {flowName} in Power Automate" />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<dialog bind:this={dialogEl} class="modal" aria-labelledby="failure-dialog-title">
  <div class="modal-box max-w-lg">
    {#if selectedError}
      <h2 id="failure-dialog-title" class="pa-h3 text-lg font-semibold">{selectedError.name}</h2>
      <p class="text-sm text-base-content/70 mt-1">Error summary</p>
      <div class="bg-base-200 p-3 mt-2 text-sm rounded">
        {parseErrorMessage(selectedError.message)}
      </div>
      <details class="mt-3">
        <summary class="text-xs text-base-content/70 cursor-pointer">Raw error JSON</summary>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="bg-base-200 p-3 mt-1 text-xs font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto pa-scroll" tabindex="0" role="region" aria-label="Raw error JSON">
          {selectedError.message}
        </div>
      </details>
      <div class="mt-4">
        <ExternalLinkButton href={selectedError.runUrl} label="View this run in Power Automate" text="View in Power Automate" size="sm" variant="primary" />
      </div>
    {/if}
    <div class="modal-action">
      <form method="dialog">
        <button type="submit" class="btn btn-sm">Close</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="submit" tabindex="-1" aria-hidden="true">Close</button></form>
</dialog>
