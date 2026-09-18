<script lang="ts">
  import { ScatterChart, Tooltip } from 'layerchart';
  import { status, theme } from '$lib/utils/chartTheme';
  import { runsByFlow, parseDuration, medianOf } from '$lib/stores/flowSessionStore';
  import { flowNameMap } from '$lib/stores/flowStore';
  import { formatDurationSeconds } from '$lib/utils/dateUtils';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  type Band = 'ok' | 'warn' | 'bad';

  interface FlowPoint {
    name: string;
    runs: number;
    avgDur: number;
    failRate: number;
    cost: number;
    band: Band;
  }

  // Failure rate, so the thresholds run the other way to healthColour.
  function bandFor(failRate: number): Band {
    if (failRate >= 30) return 'bad';
    if (failRate >= 10) return 'warn';
    return 'ok';
  }

  let points = $derived.by((): FlowPoint[] => {
    const names = $flowNameMap;
    const data: FlowPoint[] = [];

    $runsByFlow.forEach((runs, flowId) => {
      const count = runs.length;
      if (count === 0) return;

      const durations: number[] = [];
      let failCount = 0;
      runs.forEach((r) => {
        const dur = parseDuration(r.duration);
        if (dur > 0) durations.push(dur);
        if (r.status === 'Failed' || r.status === 'Cancelled') failCount++;
      });
      // Median, so a few runs left waiting on an approval don't make a quick
      // flow look slow. Total time still counts them: that time was spent.
      const avgDur = medianOf(durations);
      const totalDur = durations.reduce((sum, d) => sum + d, 0);
      const failRate = Math.round((failCount / count) * 100);

      data.push({
        name: names.get(flowId) ?? flowId.substring(0, 8),
        runs: count,
        avgDur,
        failRate,
        // Dot size tracks total time spent across every run.
        cost: Math.sqrt(totalDur),
        band: bandFor(failRate),
      });
    });

    return data;
  });

  const bandColours: Record<Band, string> = {
    ok: theme.primary,
    warn: status.cancelled,
    bad: status.failed,
  };

  const legend = [
    { key: 'ok', label: 'Under 10% failing', color: bandColours.ok },
    { key: 'warn', label: '10 to 29% failing', color: bandColours.warn },
    { key: 'bad', label: '30% or more failing', color: bandColours.bad },
  ];

  const columns: ChartColumn[] = [
    { key: 'name', label: 'Flow' },
    { key: 'runs', label: 'Runs' },
    { key: 'avgDur', label: 'Median duration' },
    { key: 'failRate', label: 'Failure rate' },
  ];

  let rows = $derived(
    [...points]
      .sort((a, b) => b.cost - a.cost)
      .map((p) => ({
        name: p.name,
        runs: p.runs,
        avgDur: formatDurationSeconds(p.avgDur),
        failRate: `${p.failRate}%`,
      }))
  );

  let summary = $derived.by(() => {
    if (points.length === 0) return '';
    const top = [...points].sort((a, b) => b.cost - a.cost)[0];
    return `${points.length} flows plotted by run count against median run time. The biggest time cost is ${top.name}: ${top.runs} runs, typically ${formatDurationSeconds(top.avgDur)} each.`;
  });
</script>

<ChartFrame
  title="Optimisation Targets"
  caption="High frequency and long duration: optimise first"
  {summary}
  {columns}
  {rows}
  {legend}
  emptyMessage="No flow runs in this period."
>
  <ScatterChart
    data={points}
    x="runs"
    y="avgDur"
    r="cost"
    rRange={[4, 20]}
    c="band"
    cDomain={['ok', 'warn', 'bad']}
    cRange={[bandColours.ok, bandColours.warn, bandColours.bad]}
    xNice
    yNice
    padding={{ top: 8, right: 8, bottom: 36, left: 64 }}
    props={{
      points: { fillOpacity: 0.8 },
      xAxis: { label: 'Run count', format: 'integer' },
      yAxis: { label: 'Median duration', format: (v: number) => formatDurationSeconds(v) },
    }}
  >
    {#snippet tooltip()}
      <Tooltip.Root>
        {#snippet children({ data })}
          <Tooltip.Header value={data.name} />
          <Tooltip.List>
            <Tooltip.Item label="Runs" value={data.runs} />
            <Tooltip.Item label="Median duration" value={formatDurationSeconds(data.avgDur)} />
            <Tooltip.Item label="Failure rate" value={`${data.failRate}%`} color={bandColours[data.band as Band]} />
          </Tooltip.List>
        {/snippet}
      </Tooltip.Root>
    {/snippet}
  </ScatterChart>
</ChartFrame>
