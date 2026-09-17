<script lang="ts">
  import { BarChart } from 'layerchart';
  import { status } from '$lib/utils/chartTheme';
  import { flowRuns } from '$lib/stores/flowSessionStore';
  import { dashboardTimeRange } from '$lib/stores/dashboardFilters';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  /**
   * Weekly runs stacked by outcome. The ECharts version drew rate lines on a
   * second axis over a totals bar; LayerChart 2.0.1 has no dual-axis chart, so
   * the stack carries both volume and outcome mix on one scale, and the rates
   * sit in the data table.
   */
  const seriesDefs = [
    { key: 'succeeded', label: 'Succeeded', color: status.succeeded },
    { key: 'cancelled', label: 'Cancelled', color: status.cancelled },
    { key: 'failed', label: 'Failed', color: status.failed },
    { key: 'other', label: 'Other', color: status.running },
  ];

  function getMonday(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d;
  }

  function formatWeekLabel(weekStart: Date): string {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `${fmt(weekStart)} to ${fmt(weekEnd)}`;
  }

  const rate = (num: number, total: number) => (total === 0 ? 0 : Math.round((num / total) * 1000) / 10);

  let weeks = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - $dashboardTimeRange);

    const weekMap = new Map<number, { succeeded: number; failed: number; cancelled: number; other: number }>();
    let ws = getMonday(cutoff);
    const todayMonday = getMonday(today);
    while (ws.getTime() <= todayMonday.getTime()) {
      weekMap.set(ws.getTime(), { succeeded: 0, failed: 0, cancelled: 0, other: 0 });
      const next = new Date(ws);
      next.setDate(next.getDate() + 7);
      ws = next;
    }

    for (const r of $flowRuns) {
      if (!r.starttime) continue;
      const bucket = weekMap.get(getMonday(new Date(r.starttime)).getTime());
      if (!bucket) continue;
      if (r.status === 'Succeeded') bucket.succeeded++;
      else if (r.status === 'Failed') bucket.failed++;
      else if (r.status === 'Cancelled') bucket.cancelled++;
      else bucket.other++;
    }

    return [...weekMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ts, b]) => {
        const total = b.succeeded + b.failed + b.cancelled + b.other;
        return {
          week: formatWeekLabel(new Date(ts)),
          ...b,
          total,
          successRate: rate(b.succeeded, total),
          failureRate: rate(b.failed, total),
          cancelledRate: rate(b.cancelled, total),
        };
      });
  });

  let grandTotal = $derived(weeks.reduce((sum, w) => sum + w.total, 0));

  const columns: ChartColumn[] = [
    { key: 'week', label: 'Week' },
    { key: 'total', label: 'Runs' },
    { key: 'successRate', label: 'Success rate' },
    { key: 'failureRate', label: 'Failure rate' },
    { key: 'cancelledRate', label: 'Cancelled rate' },
  ];

  let rows = $derived(
    grandTotal === 0
      ? []
      : weeks.map((w) => ({
          week: w.week,
          total: w.total,
          successRate: `${w.successRate}%`,
          failureRate: `${w.failureRate}%`,
          cancelledRate: `${w.cancelledRate}%`,
        }))
  );

  let summary = $derived.by(() => {
    const withRuns = weeks.filter((w) => w.total > 0);
    if (withRuns.length === 0) return '';
    const latest = withRuns[withRuns.length - 1];
    const lowest = [...withRuns].sort((a, b) => a.successRate - b.successRate)[0];
    return `${grandTotal} runs across ${weeks.length} weeks. Latest week (${latest.week}): ${latest.total} runs, ${latest.successRate}% succeeded. Lowest success rate: ${lowest.week}, ${lowest.successRate}%.`;
  });
</script>

<ChartFrame
  title="Weekly Status Trend"
  {summary}
  {columns}
  {rows}
  height={208}
  emptyMessage="No flow runs in this period."
  legend={seriesDefs}
>
  <BarChart data={weeks} x="week" series={seriesDefs} seriesLayout="stack" />
</ChartFrame>
