<script lang="ts">
  import { BarChart } from 'layerchart';
  import { theme } from '$lib/utils/chartTheme';
  import { flowRuns, parseDuration, medianOf } from '$lib/stores/flowSessionStore';
  import { flowNameMap } from '$lib/stores/flowStore';
  import { formatDurationSeconds } from '$lib/utils/dateUtils';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  let entries = $derived.by(() => {
    const names = $flowNameMap;
    const durationMap = new Map<string, { durations: number[]; name: string }>();
    for (const r of $flowRuns) {
      const dur = parseDuration(r.duration);
      if (!dur || dur <= 0) continue;
      const flowId = r.workflowid ?? 'unknown';
      const existing = durationMap.get(flowId) ?? { durations: [], name: names.get(flowId) ?? flowId.substring(0, 8) };
      existing.durations.push(dur);
      durationMap.set(flowId, existing);
    }

    return [...durationMap.values()]
      .map((d) => ({ name: d.name, avg: medianOf(d.durations), runs: d.durations.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);
  });

  const columns: ChartColumn[] = [
    { key: 'name', label: 'Flow' },
    { key: 'avg', label: 'Median duration' },
    { key: 'runs', label: 'Runs' },
  ];

  let rows = $derived(entries.map((e) => ({ name: e.name, avg: formatDurationSeconds(e.avg), runs: e.runs })));

  let summary = $derived(
    entries.length === 0
      ? ''
      : `The ${entries.length} slowest flows by median run time. Slowest: ${entries[0].name}, typically ${formatDurationSeconds(entries[0].avg)} across ${entries[0].runs} runs.`
  );

  const truncate = (name: string) => (name.length > 22 ? `${name.slice(0, 21)}…` : name);
</script>

<ChartFrame
  title="Slowest Flows (Median Run Time)"
  {summary}
  {columns}
  {rows}
  height={256}
  emptyMessage="No completed runs with a recorded duration in this period."
>
  <BarChart
    data={entries}
    x="avg"
    y="name"
    orientation="horizontal"
    series={[{ key: 'avg', label: 'Median duration', color: theme.primary }]}
    padding={{ left: 150, bottom: 24 }}
    props={{
      xAxis: { format: (v: number) => formatDurationSeconds(v) },
      yAxis: { format: (v: string) => truncate(v) },
    }}
  />
</ChartFrame>
