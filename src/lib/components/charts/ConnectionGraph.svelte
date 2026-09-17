<script lang="ts">
  import ClusterGraph from './ClusterGraph.svelte';
  import type { ClusterNode, ClusterLink, LegendEntry } from './ClusterGraph.svelte';
  import { connectionGraph } from '$lib/stores/connectionReferenceStore';
  import { chrome, entity, status, theme } from '$lib/utils/chartTheme';

  interface Props {
    height?: number;
  }

  let { height = 620 }: Props = $props();

  const COLOURS = {
    solution: theme.secondary,
    reference: entity.connectionReference,
    orphan: status.failed,
    flow: status.succeeded,
    inactive: chrome.axis,
  };

  const legend: LegendEntry[] = [
    { label: 'Solution', colour: COLOURS.solution },
    { label: 'Reference', colour: COLOURS.reference },
    { label: 'Orphaned', colour: COLOURS.orphan },
    { label: 'Flow', colour: COLOURS.flow },
    { label: 'Inactive', colour: COLOURS.inactive },
  ];

  let showFlows = $state(true);
  let orphansOnly = $state(false);

  /** Filters applied before mapping, so hidden nodes cost nothing to lay out. */
  let filtered = $derived.by(() => {
    let nodes = $connectionGraph.nodes;
    let links = $connectionGraph.links;

    if (orphansOnly) {
      const keep = new Set(
        nodes.filter((n) => n.kind === 'reference' && n.orphaned).map((n) => n.id)
      );
      links = links.filter((l) => keep.has(l.source) || keep.has(l.target));
      const connected = new Set<string>(keep);
      links.forEach((l) => {
        connected.add(l.source);
        connected.add(l.target);
      });
      nodes = nodes.filter((n) => connected.has(n.id));
    }

    if (!showFlows) {
      nodes = nodes.filter((n) => n.kind !== 'flow');
      const ids = new Set(nodes.map((n) => n.id));
      links = links.filter((l) => ids.has(l.source) && ids.has(l.target));
    }

    return { nodes, links };
  });

  let graphNodes = $derived<ClusterNode[]>(
    filtered.nodes.map((n) => {
      if (n.kind === 'solution') {
        return {
          id: n.id,
          label: n.label,
          hub: true,
          colour: COLOURS.solution,
          radius: Math.min(24, 8 + n.referenceCount * 1.1),
          group: 'Solution',
          detail: `Solution · ${n.referenceCount} reference${n.referenceCount === 1 ? '' : 's'}`,
        };
      }

      if (n.kind === 'reference') {
        const bound = n.orphaned
          ? 'no flows (orphaned)'
          : `${n.flowCount} flow${n.flowCount === 1 ? '' : 's'}`;
        return {
          id: n.id,
          label: n.label,
          hub: false,
          colour: n.orphaned ? COLOURS.orphan : COLOURS.reference,
          radius: Math.min(18, 6 + n.flowCount * 1.1),
          group: 'Connection reference',
          detail: `${n.connector} · ${bound}${n.unsolutioned ? ' · not in a solution' : ''}`,
          flagged: n.unsolutioned,
        };
      }

      return {
        id: n.id,
        label: n.label,
        hub: false,
        colour: n.active ? COLOURS.flow : COLOURS.inactive,
        radius: 4.5,
        group: 'Flow',
        detail: n.active ? 'Flow' : 'Flow (inactive)',
      };
    })
  );

  let graphLinks = $derived<ClusterLink[]>(
    filtered.links.map((l) => ({
      source: l.source,
      target: l.target,
      primary: l.kind === 'solution-reference',
    }))
  );

  let counts = $derived({
    solutions: $connectionGraph.nodes.filter((n) => n.kind === 'solution').length,
    references: $connectionGraph.nodes.filter((n) => n.kind === 'reference').length,
    orphans: $connectionGraph.nodes.filter((n) => n.kind === 'reference' && n.orphaned).length,
    flows: $connectionGraph.nodes.filter((n) => n.kind === 'flow').length,
  });

  let caption = $derived(
    `${counts.solutions} solutions · ${counts.references} references (${counts.orphans} orphaned) · ` +
      `${counts.flows} flows. Each solution is grouped with the references and flows it contains. ` +
      `References that belong to no solution are grouped separately on the right. ` +
      `Click any node to inspect it, drag to rearrange, scroll to zoom.`
  );
</script>

{#snippet filters()}
  <label class="flex items-center gap-1.5 cursor-pointer">
    <input type="checkbox" class="checkbox checkbox-xs" bind:checked={showFlows} />
    Show flows
  </label>
  <label class="flex items-center gap-1.5 cursor-pointer">
    <input type="checkbox" class="checkbox checkbox-xs" bind:checked={orphansOnly} />
    Orphans only
  </label>
{/snippet}

<ClusterGraph
  nodes={graphNodes}
  links={graphLinks}
  title="Solution → connection reference → flow"
  {caption}
  {legend}
  {height}
  emptyMessage="No connection references found."
  controls={filters}
/>
