<script lang="ts" module>
  export interface DonutSlice {
    label: string;
    value: number;
    /** Omit to take the next categorical series colour. */
    color?: string;
  }
</script>

<script lang="ts">
  import { PieChart } from 'layerchart';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';
  import { seriesColour } from '$lib/utils/chartTheme';

  /**
   * A donut with its legend, summary and data table. Every part-of-a-whole
   * chart in the app goes through this, so they all read and behave alike.
   */
  interface Props {
    title: string;
    data: DonutSlice[];
    /** What one unit is, for the summary and table: "runs", "apps". */
    unit: string;
    /** Column heading for the slice labels. */
    categoryLabel: string;
    emptyMessage?: string;
    /** Slices beyond this are folded into "Other". */
    maxSlices?: number;
    height?: number;
  }

  let { title, data, unit, categoryLabel, emptyMessage, maxSlices = 8, height = 240 }: Props = $props();

  let slices = $derived.by(() => {
    const sorted = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    if (sorted.length <= maxSlices) return sorted;
    const kept = sorted.slice(0, maxSlices - 1);
    const other = sorted.slice(maxSlices - 1).reduce((sum, d) => sum + d.value, 0);
    return [...kept, { label: 'Other', value: other }];
  });

  let coloured = $derived(slices.map((d, i) => ({ ...d, color: d.color ?? seriesColour(i) })));
  let total = $derived(slices.reduce((sum, d) => sum + d.value, 0));

  let tableColumns = $derived<ChartColumn[]>([
    { key: 'label', label: categoryLabel },
    { key: 'value', label: unit.charAt(0).toUpperCase() + unit.slice(1) },
    { key: 'share', label: 'Share' },
  ]);

  let rows = $derived(
    coloured.map((d) => ({
      label: d.label,
      value: d.value,
      share: `${Math.round((d.value / total) * 100)}%`,
    }))
  );

  let summary = $derived.by(() => {
    if (total === 0) return '';
    const top = coloured[0];
    return `${total} ${unit} across ${coloured.length} ${coloured.length === 1 ? 'group' : 'groups'}. Largest: ${top.label}, ${top.value} ${unit}, ${Math.round((top.value / total) * 100)}% of the total.`;
  });
</script>

<ChartFrame
  {title}
  {summary}
  columns={tableColumns}
  {rows}
  {emptyMessage}
  {height}
  legend={coloured.map((d) => ({ key: d.label, color: d.color }))}
>
  <PieChart
    data={coloured}
    key="label"
    value="value"
    cRange={coloured.map((d) => d.color)}
    innerRadius={-24}
    cornerRadius={3}
    padAngle={0.02}
  />
</ChartFrame>
