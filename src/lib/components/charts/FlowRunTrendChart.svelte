<script lang="ts">
  import { LineChart } from 'layerchart';
  import { status } from '$lib/utils/chartTheme';
  import type { Flowruns } from '@models/FlowrunsModel';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  let { runs, flowName = 'Flow', days = 30 } = $props<{
    runs: Flowruns[];
    flowName?: string;
    days?: number;
  }>();

  const seriesDefs = [
    { key: 'succeeded', label: 'Succeeded', color: status.succeeded },
    { key: 'cancelled', label: 'Cancelled', color: status.cancelled },
    { key: 'failed', label: 'Failed', color: status.failed },
  ];

  const formatDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  let points = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows: { date: Date; succeeded: number; failed: number; cancelled: number }[] = [];
    const indexByDay = new Map<number, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      indexByDay.set(d.getTime(), rows.length);
      rows.push({ date: d, succeeded: 0, failed: 0, cancelled: 0 });
    }

    for (const r of runs as Flowruns[]) {
      if (!r.starttime) continue;
      const day = new Date(r.starttime);
      day.setHours(0, 0, 0, 0);
      const index = indexByDay.get(day.getTime());
      if (index === undefined) continue;
      if (r.status === 'Succeeded') rows[index].succeeded++;
      else if (r.status === 'Failed') rows[index].failed++;
      else if (r.status === 'Cancelled') rows[index].cancelled++;
    }
    return rows;
  });

  let totals = $derived(
    points.reduce(
      (acc, d) => ({
        succeeded: acc.succeeded + d.succeeded,
        failed: acc.failed + d.failed,
        cancelled: acc.cancelled + d.cancelled,
      }),
      { succeeded: 0, failed: 0, cancelled: 0 }
    )
  );
  let total = $derived(totals.succeeded + totals.failed + totals.cancelled);

  const columns: ChartColumn[] = [
    { key: 'date', label: 'Date' },
    ...seriesDefs.map((s) => ({ key: s.key, label: s.label })),
  ];

  let rows = $derived(
    total === 0
      ? []
      : points.map((d) => ({
          date: formatDay(d.date),
          succeeded: d.succeeded,
          cancelled: d.cancelled,
          failed: d.failed,
        }))
  );

  let summary = $derived(
    total === 0
      ? ''
      : `${flowName} ran ${total} times in the last ${days} days: ${totals.succeeded} succeeded, ${totals.failed} failed, ${totals.cancelled} cancelled.`
  );
</script>

<ChartFrame
  title="{flowName}: Run Trend"
  {summary}
  {columns}
  {rows}
  height={208}
  emptyMessage="This flow has no runs in this period."
  legend={seriesDefs}
>
  <LineChart
    data={points}
    x="date"
    series={seriesDefs}
    props={{ xAxis: { format: (d: Date) => formatDay(d) } }}
  />
</ChartFrame>
