<script lang="ts">
  import { LineChart } from 'layerchart';
  import { curveLinearClosed } from 'd3-shape';
  import { entity, theme, healthColour, healthInk } from '$lib/utils/chartTheme';
  import { successRate } from '$lib/stores/flowSessionStore';
  import { activeFlowCount, flowCount } from '$lib/stores/flowStore';
  import { canvasAppCount } from '$lib/stores/canvasAppStore';
  import { modelAppCount } from '$lib/stores/modelAppStore';
  import { solutionCount } from '$lib/stores/solutionStore';
  import { botCount } from '$lib/stores/botStore';
  import { activeUsers } from '$lib/stores/userStore';
  import ChartFrame, { type ChartColumn } from './ChartFrame.svelte';

  function normalise(value: number, max: number): number {
    if (max === 0) return 0;
    return Math.min(Math.round((value / max) * 100), 100);
  }

  interface Dimension {
    label: string;
    score: number;
    raw: string;
    description: string;
    colour: string;
  }

  let dimensions = $derived.by((): Dimension[] => {
    const rate = $successRate;
    const totalFlows = $flowCount;
    const activeFlows = $activeFlowCount;
    const apps = $canvasAppCount + $modelAppCount;
    const sols = $solutionCount;
    const agents = $botCount;
    const users = $activeUsers.length;

    return [
      {
        label: 'Flow Health',
        score: rate,
        raw: `${rate}%`,
        description: 'Success rate of flow runs in the selected period. Above 90% is healthy.',
        colour: healthColour(rate)
      },
      {
        label: 'Flow Coverage',
        score: normalise(activeFlows, Math.max(totalFlows, 1)),
        raw: `${activeFlows}/${totalFlows}`,
        description: 'Proportion of flows that are active. Low coverage means inactive flows that could be cleaned up.',
        colour: entity.flow
      },
      {
        label: 'App Density',
        score: normalise(apps, 50),
        raw: `${apps} apps`,
        description: 'Total Canvas + Model-driven apps. Normalised against 50 apps as a healthy benchmark.',
        colour: entity.canvasApp
      },
      {
        label: 'Solutions',
        score: normalise(sols, 30),
        raw: `${sols} solutions`,
        description: 'Solution count indicates platform maturity. Normalised against 30 as a benchmark.',
        colour: entity.publisher
      },
      {
        label: 'Agents',
        score: normalise(agents, 10),
        raw: `${agents} agents`,
        description: 'Copilot Studio agents deployed. Measures AI/automation adoption.',
        colour: entity.agent
      },
      {
        label: 'User Adoption',
        score: normalise(users, 100),
        raw: `${users} active`,
        description: 'Active environment users. Normalised against 100 as a benchmark for a healthy environment.',
        colour: entity.modelApp
      },
    ];
  });

  const columns: ChartColumn[] = [
    { key: 'label', label: 'Dimension' },
    { key: 'score', label: 'Score' },
    { key: 'raw', label: 'Measured' },
  ];

  let rows = $derived(dimensions.map((d) => ({ label: d.label, score: `${d.score}%`, raw: d.raw })));

  let summary = $derived.by(() => {
    const sorted = [...dimensions].sort((a, b) => b.score - a.score);
    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];
    return `Strongest dimension: ${strongest.label} at ${strongest.score}%. Weakest: ${weakest.label} at ${weakest.score}%.`;
  });
</script>

<ChartFrame title="Environment Health" {summary} {columns} {rows} height={288}>
  <LineChart
    data={dimensions}
    x="label"
    y="score"
    yDomain={[0, 100]}
    padding={{ top: 28, bottom: 28, left: 96, right: 96 }}
    radial
    points
    props={{
      spline: {
        curve: curveLinearClosed,
        stroke: theme.primary,
        strokeWidth: 2,
        fill: theme.primary,
        fillOpacity: 0.18,
      },
      points: { fill: theme.primary },
      xAxis: { tickLength: 0 },
      yAxis: { ticks: [25, 50, 75, 100], format: () => '' },
      grid: { yTicks: [25, 50, 75, 100], radialY: 'linear' },
      highlight: { lines: false },
      tooltip: { context: { mode: 'voronoi' } },
    }}
  />

  {#snippet aside()}
    <ul class="flex flex-col gap-2 justify-center h-full list-none p-0 m-0">
      {#each dimensions as dim (dim.label)}
        <li class="flex items-start gap-3 p-2 rounded hover:bg-base-200 transition-colors">
          <div class="flex flex-col items-center min-w-[48px]">
            <span class="text-lg font-bold" style="color: {healthInk(dim.score)}">{dim.score}%</span>
            <span class="text-[10px] text-base-content/70">{dim.raw}</span>
          </div>
          <div>
            <p class="text-sm font-semibold m-0">{dim.label}</p>
            <p class="text-xs text-base-content/70 m-0 leading-relaxed">{dim.description}</p>
          </div>
        </li>
      {/each}
    </ul>
  {/snippet}
</ChartFrame>
