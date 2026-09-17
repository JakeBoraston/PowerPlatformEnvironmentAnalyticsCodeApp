<script lang="ts">
  import { failedRuns } from '$lib/stores/flowSessionStore';
  import { flowNameMap } from '$lib/stores/flowStore';
  import DonutChart from './DonutChart.svelte';

  let data = $derived.by(() => {
    const names = $flowNameMap;
    const counts = new Map<string, { label: string; value: number }>();
    for (const r of $failedRuns) {
      const flowId = r.workflowid ?? 'unknown';
      const existing = counts.get(flowId) ?? { label: names.get(flowId) ?? flowId.substring(0, 8), value: 0 };
      existing.value++;
      counts.set(flowId, existing);
    }
    return [...counts.values()];
  });
</script>

<DonutChart
  title="Failures by Flow"
  {data}
  unit="failed runs"
  categoryLabel="Flow"
  emptyMessage="No failed runs in this period."
/>
