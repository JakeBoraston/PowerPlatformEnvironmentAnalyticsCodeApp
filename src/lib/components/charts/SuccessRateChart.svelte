<script lang="ts">
  import { Arc, Chart, Svg, Text } from 'layerchart';
  import { healthColour, healthInk, chrome } from '$lib/utils/chartTheme';
  import { successRate, totalRuns, succeededRuns } from '$lib/stores/flowSessionStore';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  const domain: [number, number] = [0, 100];
  const angleRange: [number, number] = [-120, 120];

  let rate = $derived($successRate);

  const columns: ChartColumn[] = [
    { key: 'metric', label: 'Measure' },
    { key: 'value', label: 'Value' },
  ];

  let rows = $derived(
    $totalRuns > 0
      ? [
          { metric: 'Success rate', value: `${rate}%` },
          { metric: 'Succeeded runs', value: $succeededRuns.length },
          { metric: 'All runs', value: $totalRuns },
        ]
      : []
  );

  let summary = $derived(
    `${rate}% of ${$totalRuns} flow runs succeeded in this period, which is ${
      rate >= 90 ? 'healthy' : rate >= 70 ? 'degraded' : 'poor'
    }.`
  );
</script>

<ChartFrame
  title="Success Rate"
  {summary}
  {columns}
  {rows}
  emptyMessage="No flow runs in this period."
  height={208}
>
  <Chart>
    <Svg center>
      <Arc
        value={rate}
        {domain}
        range={angleRange}
        innerRadius={-16}
        cornerRadius={8}
        fill={healthColour(rate)}
        track={{ fill: chrome.split }}
      />
      <Text
        value={`${rate}%`}
        textAnchor="middle"
        verticalAnchor="middle"
        fontSize={28}
        class="font-bold"
        fill={healthInk(rate)}
      />
      <Text
        value="Succeeded"
        y={26}
        textAnchor="middle"
        verticalAnchor="middle"
        fontSize={12}
        fill={chrome.muted}
      />
    </Svg>
  </Chart>
</ChartFrame>
