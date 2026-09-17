<script lang="ts">
  import { AreaChart } from 'layerchart';
  import { status } from '$lib/utils/chartTheme';
  import { flowRuns } from '$lib/stores/flowSessionStore';
  import { dashboardTimeRange } from '$lib/stores/dashboardFilters';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  type Bucket = 'succeeded' | 'failed' | 'cancelled' | 'other';

  const seriesDefs: { key: Bucket; label: string; color: string }[] = [
    { key: 'succeeded', label: 'Succeeded', color: status.succeeded },
    { key: 'cancelled', label: 'Cancelled', color: status.cancelled },
    { key: 'failed', label: 'Failed', color: status.failed },
    { key: 'other', label: 'Other', color: status.running },
  ];

  const formatDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  let days = $derived.by(() => {
    const timeRange = $dashboardTimeRange;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows: { date: Date; succeeded: number; failed: number; cancelled: number; other: number }[] = [];
    const indexByDay = new Map<number, number>();
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      indexByDay.set(d.getTime(), rows.length);
      rows.push({ date: d, succeeded: 0, failed: 0, cancelled: 0, other: 0 });
    }

    for (const r of $flowRuns) {
      if (!r.starttime) continue;
      const day = new Date(r.starttime);
      day.setHours(0, 0, 0, 0);
      const index = indexByDay.get(day.getTime());
      if (index === undefined) continue;
      const row = rows[index];
      if (r.status === 'Succeeded') row.succeeded++;
      else if (r.status === 'Failed') row.failed++;
      else if (r.status === 'Cancelled') row.cancelled++;
      else row.other++;
    }
    return rows;
  });

  const dayTotal = (d: { succeeded: number; failed: number; cancelled: number; other: number }) =>
    d.succeeded + d.failed + d.cancelled + d.other;

  let totals = $derived(
    days.reduce(
      (acc, d) => ({
        succeeded: acc.succeeded + d.succeeded,
        failed: acc.failed + d.failed,
        cancelled: acc.cancelled + d.cancelled,
        other: acc.other + d.other,
      }),
      { succeeded: 0, failed: 0, cancelled: 0, other: 0 }
    )
  );
  let total = $derived(dayTotal(totals));

  let busiest = $derived(
    days.reduce<{ date: Date | null; count: number }>(
      (best, d) => (dayTotal(d) > best.count ? { date: d.date, count: dayTotal(d) } : best),
      { date: null, count: 0 }
    )
  );

  const columns: ChartColumn[] = [
    { key: 'date', label: 'Date' },
    ...seriesDefs.map((s) => ({ key: s.key, label: s.label })),
    { key: 'total', label: 'Total' },
  ];

  let rows = $derived(
    total === 0
      ? []
      : days.map((d) => ({
          date: formatDay(d.date),
          succeeded: d.succeeded,
          cancelled: d.cancelled,
          failed: d.failed,
          other: d.other,
          total: dayTotal(d),
        }))
  );

  let summary = $derived(
    total === 0
      ? ''
      : `${total} runs over the last ${days.length} days: ${totals.succeeded} succeeded, ${totals.failed} failed, ${totals.cancelled} cancelled, ${totals.other} other.` +
          (busiest.date ? ` Busiest day: ${formatDay(busiest.date)}, ${busiest.count} runs.` : '')
  );
</script>

<ChartFrame
  title="Runs Over Time"
  {summary}
  {columns}
  {rows}
  height={208}
  emptyMessage="No flow runs in this period."
  legend={seriesDefs}
>
  <AreaChart
    data={days}
    x="date"
    series={seriesDefs}
    seriesLayout="stack"
    props={{ xAxis: { format: (d: Date) => formatDay(d) } }}
  />
</ChartFrame>
