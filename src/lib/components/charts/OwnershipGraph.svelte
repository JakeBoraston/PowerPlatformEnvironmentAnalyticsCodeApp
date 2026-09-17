<script lang="ts">
  import ClusterGraph from './ClusterGraph.svelte';
  import type { ClusterNode, ClusterLink, LegendEntry } from './ClusterGraph.svelte';
  import { entity } from '$lib/utils/chartTheme';
  import { workflows } from '$lib/stores/flowStore';
  import { canvasApps } from '$lib/stores/canvasAppStore';
  import { modelApps } from '$lib/stores/modelAppStore';
  import { bots } from '$lib/stores/botStore';
  import { solutions, getPublisherName } from '$lib/stores/solutionStore';
  import { userNameMap } from '$lib/stores/userStore';

  interface Props {
    height?: number;
  }

  let { height = 620 }: Props = $props();

  const legend: LegendEntry[] = [
    { label: 'Owner', colour: entity.owner },
    { label: 'Publisher', colour: entity.publisher },
    { label: 'Flow', colour: entity.flow },
    { label: 'Canvas app', colour: entity.canvasApp },
    { label: 'Model app', colour: entity.modelApp },
    { label: 'Agent', colour: entity.agent },
    { label: 'Solution', colour: entity.solution },
  ];

  let showFlows = $state(true);
  let unownedOnly = $state(false);

  /** Owner IDs sit on different fields depending on how the record was created. */
  function resolveOwner(record: any, nameMap: Map<string, string>): string | null {
    const ids = [
      record._owninguser_value,
      record.ownerid,
      record.aadcreatedbyid,
      record.aadlastmodifiedbyid,
    ];
    for (const id of ids) {
      if (id) {
        const name = nameMap.get(String(id).toLowerCase());
        if (name) return name;
      }
    }
    return record.owneridname ?? null;
  }

  interface Item {
    id: string;
    label: string;
    colour: string;
    group: string;
    /** Owner or publisher name; null means nothing claims it. */
    hubName: string | null;
    hubKind: 'owner' | 'publisher';
  }

  let items = $derived.by((): Item[] => {
    const nameMap = $userNameMap;
    const out: Item[] = [];

    if (showFlows) {
      $workflows.forEach((f) =>
        out.push({
          id: `flow:${f.workflowid}`,
          label: f.name,
          colour: entity.flow,
          group: 'Flow',
          hubName: resolveOwner(f, nameMap),
          hubKind: 'owner',
        })
      );
    }

    $canvasApps.forEach((a) =>
      out.push({
        id: `canvas:${a.canvasappid}`,
        label: a.displayname ?? a.name,
        colour: entity.canvasApp,
        group: 'Canvas app',
        hubName: resolveOwner(a, nameMap),
        hubKind: 'owner',
      })
    );

    $modelApps.forEach((a) =>
      out.push({
        id: `model:${a.appmoduleid}`,
        label: a.name,
        colour: entity.modelApp,
        group: 'Model app',
        hubName: resolveOwner(a, nameMap),
        hubKind: 'owner',
      })
    );

    $bots.forEach((b) =>
      out.push({
        id: `agent:${b.botid}`,
        label: b.name ?? b.schemaname,
        colour: entity.agent,
        group: 'Agent',
        hubName: resolveOwner(b, nameMap),
        hubKind: 'owner',
      })
    );

    $solutions.forEach((s) => {
      const publisher = getPublisherName(s);
      out.push({
        id: `solution:${s.solutionid}`,
        label: s.friendlyname ?? s.uniquename ?? 'Unnamed solution',
        colour: entity.solution,
        group: 'Solution',
        hubName: publisher && publisher !== '—' ? publisher : null,
        hubKind: 'publisher',
      });
    });

    return unownedOnly ? out.filter((i) => i.hubName === null) : out;
  });

  let graph = $derived.by(() => {
    const nodes: ClusterNode[] = [];
    const links: ClusterLink[] = [];
    const hubs = new Map<string, { kind: 'owner' | 'publisher'; name: string; count: number }>();

    items.forEach((item) => {
      nodes.push({
        id: item.id,
        label: item.label,
        hub: false,
        colour: item.colour,
        radius: 5,
        group: item.group,
        detail: item.hubName
          ? `${item.group} · ${item.hubKind === 'owner' ? 'owned by' : 'published by'} ${item.hubName}`
          : `${item.group} · ${item.hubKind === 'owner' ? 'no owner' : 'no publisher'}`,
        // A dashed ring marks components with no owner — usually someone who has
        // left, or a solution with no publisher record.
        flagged: item.hubName === null,
      });

      if (!item.hubName) return;

      const hubId = `${item.hubKind}:${item.hubName}`;
      const existing = hubs.get(hubId);
      if (existing) {
        existing.count++;
      } else {
        hubs.set(hubId, { kind: item.hubKind, name: item.hubName, count: 1 });
      }
      links.push({ source: hubId, target: item.id, primary: true });
    });

    hubs.forEach((hub, hubId) => {
      nodes.push({
        id: hubId,
        label: hub.name,
        hub: true,
        colour: hub.kind === 'owner' ? entity.owner : entity.publisher,
        radius: Math.min(24, 8 + hub.count * 1.1),
        group: hub.kind === 'owner' ? 'Owner' : 'Publisher',
        detail: `${hub.kind === 'owner' ? 'Owner' : 'Publisher'} · ${hub.count} item${hub.count === 1 ? '' : 's'}`,
      });
    });

    return { nodes, links };
  });

  let unattributed = $derived(items.filter((i) => i.hubName === null).length);
  let hubCount = $derived(graph.nodes.filter((n) => n.hub).length);

  let caption = $derived(
    `${hubCount} owners and publishers · ${items.length} components` +
      (unattributed > 0 ? ` · ${unattributed} with no owner` : '') +
      `. Each owner is grouped with the components they own, and each publisher with the ` +
      `solutions they ship. Components with no owner are grouped separately on the right. ` +
      `Click any node to inspect it, drag to rearrange, scroll to zoom.`
  );
</script>

{#snippet filters()}
  <label class="flex items-center gap-1.5 cursor-pointer">
    <input type="checkbox" class="checkbox checkbox-xs" bind:checked={showFlows} />
    Show flows
  </label>
  <label class="flex items-center gap-1.5 cursor-pointer">
    <input type="checkbox" class="checkbox checkbox-xs" bind:checked={unownedOnly} />
    Missing owner
  </label>
{/snippet}

<ClusterGraph
  nodes={graph.nodes}
  links={graph.links}
  title="Ownership and publishers"
  {caption}
  {legend}
  {height}
  emptyMessage="No owned components found."
  controls={filters}
/>
