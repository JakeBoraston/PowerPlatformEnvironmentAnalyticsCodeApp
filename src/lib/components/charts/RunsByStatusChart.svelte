<script lang="ts">
  import { flowRuns } from '$lib/stores/flowSessionStore';
  import { status } from '$lib/utils/chartTheme';
  import DonutChart from './DonutChart.svelte';

  const statusColours: Record<string, string> = {
    Succeeded: status.succeeded,
    Failed: status.failed,
    Cancelled: status.cancelled,
    Running: status.running,
    Waiting: status.waiting,
  };

  let data = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const run of $flowRuns) {
      const name = run.status ?? 'Unknown';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({
      label,
      value,
      color: statusColours[label] ?? status.unknown,
    }));
  });
</script>

<DonutChart
  title="Runs by Status"
  {data}
  unit="runs"
  categoryLabel="Status"
  emptyMessage="No flow runs in this period."
/>
