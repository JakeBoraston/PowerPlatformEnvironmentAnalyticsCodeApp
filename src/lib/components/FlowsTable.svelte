<script lang="ts">
  import { runsByFlow, isFailure } from '$lib/stores/flowSessionStore';
  import { userNameMap, resolveOwnerName } from '$lib/stores/userStore';
  import { getFlowUrl } from '$lib/stores/powerContext';
  import { formatDate } from '$lib/utils/dateUtils';
  import ExternalLinkButton from '$lib/components/ui/ExternalLinkButton.svelte';
  import type { Workflows } from '@models/WorkflowsModel';
  import SortHeader from '$lib/components/ui/SortHeader.svelte';

  let { flows } = $props<{ flows: Workflows[] }>();

  let runsMap = $derived($runsByFlow);
  let nameMap = $derived($userNameMap);

  function getFlowStats(flowId: string) {
    const runs = runsMap.get(flowId) ?? [];
    const total = runs.length;
    const succeeded = runs.filter((r) => r.status === 'Succeeded').length;
    const failed = runs.filter((r) => isFailure(r.status)).length;
    const rate = total > 0 ? Math.round((succeeded / total) * 100) : 0;
    return { total, succeeded, failed, rate };
  }

  // --- Sort ---
  type SortField = 'name' | 'owner' | 'state' | 'total' | 'succeeded' | 'failed' | 'rate' | 'created';
  let sortField = $state<SortField>('name');
  let sortAsc = $state(true);

  function toggleSort(field: SortField) {
    if (sortField === field) { sortAsc = !sortAsc; }
    else { sortField = field; sortAsc = true; }
  }


  let sortedFlows = $derived(() => {
    const list = [...flows];
    list.sort((a, b) => {
      const statsA = getFlowStats(a.workflowid);
      const statsB = getFlowStats(b.workflowid);
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = (a.name ?? '').localeCompare(b.name ?? ''); break;
        case 'owner': cmp = resolveOwnerName(a as any, nameMap).localeCompare(resolveOwnerName(b as any, nameMap)); break;
        case 'state': cmp = (a.statecode ?? 0) - (b.statecode ?? 0); break;
        case 'total': cmp = statsA.total - statsB.total; break;
        case 'succeeded': cmp = statsA.succeeded - statsB.succeeded; break;
        case 'failed': cmp = statsA.failed - statsB.failed; break;
        case 'rate': cmp = statsA.rate - statsB.rate; break;
        case 'created': cmp = new Date(a.createdon ?? '').getTime() - new Date(b.createdon ?? '').getTime(); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  });
</script>

{#if flows.length === 0}
  <div class="text-center text-base-content/70 py-12">
    <p class="text-sm">No cloud flows found matching your filters.</p>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Cloud flows">
    <table class="table table-sm w-full">
      <thead>
        <tr>
          <SortHeader label="Flow Name" field="name" {sortField} {sortAsc} onsort={toggleSort} />
          <SortHeader label="Owner" field="owner" {sortField} {sortAsc} onsort={toggleSort} />
          <SortHeader label="State" field="state" {sortField} {sortAsc} onsort={toggleSort} align="center" />
          <SortHeader label="Total Runs" field="total" {sortField} {sortAsc} onsort={toggleSort} align="center" />
          <SortHeader label="Succeeded" field="succeeded" {sortField} {sortAsc} onsort={toggleSort} align="center" />
          <SortHeader label="Failed" field="failed" {sortField} {sortAsc} onsort={toggleSort} align="center" />
          <SortHeader label="Success Rate" field="rate" {sortField} {sortAsc} onsort={toggleSort} align="center" />
          <SortHeader label="Created" field="created" {sortField} {sortAsc} onsort={toggleSort} />
          <th class="text-center"><span class="sr-only">Open in Power Automate</span></th>
        </tr>
      </thead>
      <tbody>
        {#each sortedFlows() as flow (flow.workflowid)}
          {@const stats = getFlowStats(flow.workflowid)}
          {@const flowUrl = getFlowUrl(flow.workflowid)}
          <tr class="hover:bg-base-200 transition-colors">
            <td class="font-medium">
              <a href="#/flows/{flow.workflowid}" class="link link-hover text-base-content">{flow.name || 'Unnamed flow'}</a>
            </td>
            <td class="text-sm">{resolveOwnerName(flow as any, nameMap)}</td>
            <td class="text-center">
              <span class="pa-pill {flow.statecode === 1 ? 'pa-pill--ok' : 'pa-pill--idle'}">
                {flow.statecode === 1 ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td class="text-center">{stats.total}</td>
            <td class="text-center tabular">{stats.succeeded}</td>
            <td class="text-center tabular">{stats.failed}</td>
            <td class="text-center">
              {#if stats.total === 0}
                <span class="text-base-content/70">No runs</span>
              {:else}
                <span class="pa-pill {stats.rate >= 90 ? 'pa-pill--ok' : stats.rate >= 70 ? 'pa-pill--warn' : 'pa-pill--bad'} tabular">
                  {stats.rate}%
                </span>
              {/if}
            </td>
            <td class="text-xs text-base-content/70">{flow.createdon ? formatDate(flow.createdon) : '—'}</td>
            <td class="text-center">
              <ExternalLinkButton href={flowUrl} label="Open {flow.name} in Power Automate" />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
