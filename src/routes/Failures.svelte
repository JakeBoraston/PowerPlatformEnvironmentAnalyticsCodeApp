<script lang="ts">
  import { unsuccessfulRuns, flowRunsLoading, flowRunsError, fetchFlowRuns } from '$lib/stores/flowSessionStore';
  import FailuresTable from '$lib/components/FailuresTable.svelte';
  import TimeRangeSelect from '$lib/components/TimeRangeSelect.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  let isLoading = $derived($flowRunsLoading);
  let error = $derived($flowRunsError);
  let failureCount = $derived($unsuccessfulRuns.length);
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Failures & Cancellations"
    subtitle={`${failureCount} unsuccessful run${failureCount !== 1 ? 's' : ''} in the selected period`}
    refreshLabel="flow runs"
    refreshing={isLoading}
    onRefresh={() => fetchFlowRuns()}
  >
    {#snippet actions()}
      <TimeRangeSelect />
    {/snippet}
  </PageHeader>

  <LoadError message={error} onRetry={() => fetchFlowRuns()} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <FailuresTable />
  {/if}
</div>
