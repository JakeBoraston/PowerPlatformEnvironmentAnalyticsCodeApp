<script lang="ts">
  import { Chart, Group, Rect, Svg, Text } from 'layerchart';
  import { Treemap } from 'layerchart/hierarchy';
  import { hierarchy } from 'd3-hierarchy';
  import { entity, chrome, currentChartMode } from '$lib/utils/chartTheme';
  import { flowCount } from '$lib/stores/flowStore';
  import { canvasAppCount } from '$lib/stores/canvasAppStore';
  import { modelAppCount } from '$lib/stores/modelAppStore';
  import { solutionCount } from '$lib/stores/solutionStore';
  import { botCount } from '$lib/stores/botStore';
  import { userCount } from '$lib/stores/userStore';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  interface Tile {
    name: string;
    count: number;
    colour: string;
  }

  let tiles = $derived<Tile[]>([
    { name: 'Flows', count: $flowCount, colour: entity.flow },
    { name: 'Canvas Apps', count: $canvasAppCount, colour: entity.canvasApp },
    { name: 'Model Apps', count: $modelAppCount, colour: entity.modelApp },
    { name: 'Solutions', count: $solutionCount, colour: entity.solution },
    { name: 'Agents', count: $botCount, colour: entity.agent },
    { name: 'Users', count: $userCount, colour: entity.user },
  ]);

  // Every type keeps at least a sliver of area, so an empty one is still labelled.
  let root = $derived(
    hierarchy<{ children?: Tile[] } & Partial<Tile>>({ children: tiles }).sum((d: { children?: Tile[] } & Partial<Tile>) =>
      d.children ? 0 : Math.max(d.count ?? 0, 1)
    )
  );

  // Light fills in dark mode, dark fills in light mode: the label takes the card colour's opposite.
  const labelColour = currentChartMode() === 'dark' ? chrome.surface : '#ffffff';

  const columns: ChartColumn[] = [
    { key: 'name', label: 'Type' },
    { key: 'count', label: 'Count' },
  ];

  let rows = $derived(tiles.map((t) => ({ name: t.name, count: t.count })));

  let summary = $derived.by(() => {
    const largest = [...tiles].sort((a, b) => b.count - a.count)[0];
    const total = tiles.reduce((sum, t) => sum + t.count, 0);
    return `${total} platform items in this environment. Largest group: ${largest.name}, ${largest.count}.`;
  });
</script>

<ChartFrame
  title="Platform Inventory"
  {summary}
  {columns}
  {rows}
  height={384}
  legend={tiles.map((t) => ({ key: t.name, color: t.colour }))}
>
  <Chart>
    <Svg>
      <Treemap hierarchy={root} paddingInner={3}>
        {#snippet children({ nodes })}
          {#each nodes.filter((n) => n.depth > 0) as node (node.data.name)}
            {@const width = node.x1 - node.x0}
            {@const height = node.y1 - node.y0}
            <Group x={node.x0} y={node.y0}>
              <Rect {width} {height} rx={4} fill={node.data.colour} stroke={chrome.surface} strokeWidth={1} />
              {#if width > 56 && height > 36}
                <Text
                  x={width / 2}
                  y={height / 2 - 8}
                  value={node.data.name}
                  textAnchor="middle"
                  verticalAnchor="middle"
                  fontSize={13}
                  class="font-semibold"
                  fill={labelColour}
                />
                <Text
                  x={width / 2}
                  y={height / 2 + 10}
                  value={node.data.count}
                  textAnchor="middle"
                  verticalAnchor="middle"
                  fontSize={13}
                  class="font-bold"
                  fill={labelColour}
                />
              {/if}
            </Group>
          {/each}
        {/snippet}
      </Treemap>
    </Svg>
  </Chart>
</ChartFrame>
