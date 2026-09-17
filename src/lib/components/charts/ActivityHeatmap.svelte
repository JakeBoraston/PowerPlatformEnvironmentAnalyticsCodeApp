<script lang="ts">
  import { Axis, Cell, Chart, Svg, Tooltip } from 'layerchart';
  import { scaleBand } from 'd3-scale';
  import { ramp, chrome } from '$lib/utils/chartTheme';
  import { flowRuns } from '$lib/stores/flowSessionStore';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  /**
   * `runs` — any records with a `starttime` ISO field. Defaults to the
   * environment-wide flow runs store (dashboard usage). Pass a scoped array
   * (a single flow's runs, or an agent's conversations mapped to `{ starttime }`)
   * to render a per-record heatmap.
   */
  let { runs = undefined, title = 'Flow Activity by Day & Hour' } = $props<{
    runs?: { starttime?: string }[];
    title?: string;
  }>();

  let source = $derived(runs ?? $flowRuns);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ':00');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  interface HeatCell {
    day: string;
    hour: string;
    count: number;
  }

  let grid = $derived.by(() => {
    const counts: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let max = 0;
    let total = 0;

    source.forEach((r: { starttime?: string }) => {
      if (!r.starttime) return;
      const d = new Date(r.starttime);
      const day = (d.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
      const hour = d.getHours();
      counts[day][hour]++;
      total++;
      if (counts[day][hour] > max) max = counts[day][hour];
    });

    return { counts, max, total };
  });

  let cells = $derived<HeatCell[]>(
    days.flatMap((day, dayIndex) =>
      hours.map((hour, hourIndex) => ({ day, hour, count: grid.counts[dayIndex][hourIndex] }))
    )
  );

  // Zero stays on the lightest step; everything else is spread over the rest,
  // so a single run is always distinguishable from none.
  function fillFor(count: number): string {
    if (count === 0 || grid.max === 0) return ramp[0];
    const steps = ramp.length - 1;
    return ramp[Math.min(steps, Math.ceil((count / grid.max) * steps))];
  }

  const hourTicks = hours.filter((_, i) => i % 3 === 0);

  let columns = $derived<ChartColumn[]>([
    { key: 'day', label: 'Day' },
    ...hours.map((h) => ({ key: h, label: h })),
  ]);

  let rows = $derived(
    grid.total > 0
      ? days.map((day, dayIndex) => {
          const row: Record<string, string | number> = { day };
          hours.forEach((h, hourIndex) => (row[h] = grid.counts[dayIndex][hourIndex]));
          return row;
        })
      : []
  );

  let summary = $derived.by(() => {
    if (grid.total === 0) return '';
    let bestDay = 0;
    let bestHour = 0;
    grid.counts.forEach((row, d) =>
      row.forEach((count, h) => {
        if (count > grid.counts[bestDay][bestHour]) {
          bestDay = d;
          bestHour = h;
        }
      })
    );
    return `${grid.total} runs by weekday and hour. Busiest slot: ${days[bestDay]} at ${hours[bestHour]}, with ${grid.max}.`;
  });

  let legend = $derived(
    ramp.map((colour, i) => ({
      key: String(i),
      label: i === 0 ? 'None' : i === ramp.length - 1 ? `Up to ${grid.max}` : '',
      color: colour,
    })).filter((item) => item.label !== '')
  );
</script>

<ChartFrame {title} {summary} {columns} {rows} {legend} emptyMessage="No activity in this period.">
  <Chart
    data={cells}
    x="hour"
    xScale={scaleBand()}
    xDomain={hours}
    y="day"
    yScale={scaleBand()}
    yDomain={days}
    padding={{ top: 4, right: 4, bottom: 24, left: 40 }}
    tooltipContext={{ mode: 'quadtree' }}
  >
    <Svg>
      <Axis placement="bottom" ticks={hourTicks} tickLength={0} />
      <Axis placement="left" tickLength={0} />
      <Cell
        x="hour"
        y="day"
        fill={(d: HeatCell) => fillFor(d.count)}
        stroke={chrome.surface}
        strokeWidth={1}
        rx={2}
      />
    </Svg>
    <Tooltip.Root>
      {#snippet children({ data })}
        <Tooltip.Header value={`${data.day} ${data.hour}`} />
        <Tooltip.List>
          <Tooltip.Item label="Runs" value={data.count} />
        </Tooltip.List>
      {/snippet}
    </Tooltip.Root>
  </Chart>
</ChartFrame>
