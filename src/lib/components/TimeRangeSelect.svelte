<script lang="ts">
  import { dashboardTimeRange, timeRangeOptions } from '$lib/stores/dashboardFilters';
  import { ensureFlowRunsForRange } from '$lib/stores/flowSessionStore';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';

  // Every page showing this control reads flow runs, so a new range refetches
  // them here rather than relying on one page to notice the change.
  function setRange(days: number) {
    dashboardTimeRange.set(days);
    ensureFlowRunsForRange(days);
  }

  let { label = 'Time range' }: { label?: string } = $props();
</script>

<FilterSelect
  {label}
  options={timeRangeOptions}
  value={$dashboardTimeRange}
  onchange={setRange}
/>
