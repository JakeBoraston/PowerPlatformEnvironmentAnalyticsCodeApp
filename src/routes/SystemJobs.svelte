<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import { filterParam } from '$lib/utils/filterParam';
  import {
    systemJobs, systemJobsLoading, systemJobsError, systemJobCount,
    failedSystemJobCount, inFlightSystemJobs, systemJobSuccessRate,
    jobsByOperationType, fetchSystemJobs, systemJobsTruncated,
    operationTypeLabel, statusLabel, isFailed, isInFlight,
  } from '$lib/stores/systemJobStore';
  import { formatDate } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import { Server, TriangleAlert, Loader, Percent } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';

  let isLoading = $derived($systemJobsLoading);
  let error = $derived($systemJobsError);

  let searchQuery = $state('');
  let statusFilter = $state<'all' | 'failed' | 'inflight'>(
    filterParam($querystring, 'status', ['all', 'failed', 'inflight'] as const, 'failed')
  );
  let selectedMessage = $state<{ job: string; text: string } | null>(null);
  let messageDialog: HTMLDialogElement;

  function showMessage(job: string, text: string) {
    selectedMessage = { job, text };
    messageDialog?.showModal();
  }

  function durationLabel(startedOn: string | undefined, completedOn: string | undefined): string {
    if (!startedOn || !completedOn) return '—';
    const ms = new Date(completedOn).getTime() - new Date(startedOn).getTime();
    if (isNaN(ms) || ms < 0) return '—';
    const secs = Math.round(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ${secs % 60}s`;
  }

  let filteredJobs = $derived(() => {
    const q = searchQuery.toLowerCase();
    return $systemJobs.filter((job) => {
      if (statusFilter === 'failed' && !isFailed(job)) return false;
      if (statusFilter === 'inflight' && !isInFlight(job)) return false;
      if (!q) return true;
      const name = (job.name ?? '').toLowerCase();
      const type = operationTypeLabel(job.operationtype).toLowerCase();
      const entity = (job.primaryentitytype ?? '').toLowerCase();
      return name.includes(q) || type.includes(q) || entity.includes(q);
    });
  });
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="System Jobs"
    subtitle={$systemJobsTruncated
      ? `The most recent ${$systemJobCount.toLocaleString()} asynchronous platform operations. Older jobs are not included in these figures.`
      : `All ${$systemJobCount.toLocaleString()} asynchronous platform operations in this environment.`}
    refreshLabel="system jobs"
    refreshing={isLoading}
    onRefresh={() => fetchSystemJobs()}
  />

  <LoadError message={error} onRetry={() => fetchSystemJobs()} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Jobs" value={$systemJobCount} icon={Server} />
      <KpiCard label="Failed" value={$failedSystemJobCount} icon={TriangleAlert} tone="bad" />
      <KpiCard label="In Flight" value={$inFlightSystemJobs.length} icon={Loader} />
      <KpiCard label="Success Rate" value="{$systemJobSuccessRate}%" subtitle="of finished jobs" icon={Percent} tone={$systemJobSuccessRate >= 90 ? 'good' : $systemJobSuccessRate >= 70 ? 'warn' : 'bad'} />
    </div>

    {#if $jobsByOperationType.length > 0}
      <div class="card bg-base-100 border border-base-300 p-4">
        <h3 class="font-semibold text-sm mb-3">By operation type</h3>
        <div class="flex flex-col gap-2">
          {#each $jobsByOperationType.slice(0, 10) as entry (entry.label)}
            {@const pct = Math.round((entry.total / $jobsByOperationType[0].total) * 100)}
            <div class="flex items-center gap-3">
              <span class="text-sm w-56 shrink-0 truncate" title={entry.label}>{entry.label}</span>
              <div class="flex-1 h-2 bg-base-200 rounded-sm overflow-hidden">
                <!-- Neutral bar for volume, with only the failed share in red. -->
                <div class="h-full flex" style="width: {pct}%">
                  <div class="h-full bg-base-content/40 flex-1"></div>
                  {#if entry.failed > 0}
                    <div class="h-full bg-error" style="width: {Math.max((entry.failed / entry.total) * 100, 2)}%"></div>
                  {/if}
                </div>
              </div>
              <span class="text-xs w-36 text-right shrink-0 tabular">
                {entry.total} {entry.total === 1 ? 'job' : 'jobs'}{#if entry.failed > 0}<span class="pa-bad-text">, {entry.failed} failed</span>{/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search job, type or table…" bind:value={searchQuery} />
      <FilterSelect
        label="Status"
        options={[{ value: 'failed', label: 'Failed only' }, { value: 'inflight', label: 'In flight' }, { value: 'all', label: 'All jobs' }]}
        bind:value={statusFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">
        {filteredJobs().length} of {$systemJobCount} jobs
      </span>
    </div>

    {#if filteredJobs().length === 0}
      <div class="text-center py-16 text-sm text-base-content/70">
        No jobs match those filters.
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="System jobs">
        <table class="table table-sm w-full">
          <thead>
            <tr>
              <th>Job</th>
              <th>Operation Type</th>
              <th>Table</th>
              <th class="text-center">Status</th>
              <th>Duration</th>
              <th>Created</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredJobs() as job (job.asyncoperationid)}
              {@const failed = isFailed(job)}
              {@const message = job.friendlymessage || job.message || ''}
              <tr class="hover:bg-base-200 transition-colors">
                <td class="font-medium max-w-md truncate" title={job.name ?? ''}>{job.name || '—'}</td>
                <td class="text-sm">{operationTypeLabel(job.operationtype)}</td>
                <td class="text-xs font-mono text-base-content/70">{job.primaryentitytype || '—'}</td>
                <td class="text-center">
                  <span class="pa-pill {failed ? 'pa-pill--bad' : isInFlight(job) ? 'pa-pill--idle' : 'pa-pill--ok'}">
                    {statusLabel(job.statuscode)}
                  </span>
                </td>
                <td class="text-xs font-mono">{durationLabel(job.startedon, job.completedon)}</td>
                <td class="text-xs text-base-content/70">
                  {job.createdon ? formatDate(job.createdon) : '—'}
                </td>
                <td>
                  {#if message}
                    <button
                      type="button"
                      class="btn btn-xs btn-ghost"
                      aria-haspopup="dialog"
                      onclick={() => showMessage(job.name || 'System job', message)}
                    >
                      View<span class="sr-only"> message for {job.name || 'this job'}</span>
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<dialog bind:this={messageDialog} class="modal" aria-labelledby="job-message-title" onclose={() => (selectedMessage = null)}>
  <div class="modal-box max-w-3xl">
    <h2 id="job-message-title" class="pa-h3 font-bold text-base mb-1">Job message</h2>
    {#if selectedMessage}
      <p class="text-sm text-base-content/70 mb-3 break-words">{selectedMessage.job}</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <pre class="text-xs whitespace-pre-wrap break-words bg-base-200 p-3 max-h-96 overflow-y-auto pa-scroll" tabindex="0">{selectedMessage.text}</pre>
    {/if}
    <div class="modal-action">
      <form method="dialog">
        <button type="submit" class="btn btn-sm">Close</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="submit" tabindex="-1" aria-hidden="true">Close</button></form>
</dialog>
