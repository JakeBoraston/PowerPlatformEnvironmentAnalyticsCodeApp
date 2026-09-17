<script lang="ts" module>
  /**
   * A node in a clustered force graph.
   *
   * `hub` nodes anchor a cluster, carry a standing label and size up with their
   * spoke count. Everything else is a spoke and gets named on selection only —
   * labelling every spoke turns any real dataset into unreadable overlap.
   */
  export interface ClusterNode {
    id: string;
    label: string;
    hub: boolean;
    colour: string;
    radius: number;
    /** Group name, used for panel grouping and to correlate with the legend. */
    group: string;
    /** Secondary line shown on hover and in the panel. */
    detail?: string;
    /** Draws a dashed ring — for nodes that are anomalous in some way. */
    flagged?: boolean;
  }

  export interface ClusterLink {
    source: string;
    target: string;
    /** Hub-to-spoke links draw heavier than spoke-to-spoke. */
    primary: boolean;
  }

  export interface LegendEntry {
    label: string;
    colour: string;
  }
</script>

<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceX,
    forceY,
    forceCollide,
    type Simulation,
    type SimulationNodeDatum,
    type SimulationLinkDatum,
  } from 'd3-force';
  import { select as d3Select, type Selection } from 'd3-selection';
  import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { drag } from 'd3-drag';
  import { X } from 'lucide-svelte';
  import { chrome } from '$lib/utils/chartTheme';

  interface Props {
    nodes: ClusterNode[];
    links: ClusterLink[];
    title: string;
    caption: string;
    legend: LegendEntry[];
    height?: number;
    emptyMessage?: string;
    /** Extra filter controls, rendered next to Reset. */
    controls?: Snippet;
  }

  let {
    nodes,
    links,
    title,
    caption,
    legend,
    height = 620,
    emptyMessage = 'Nothing to show.',
    controls,
  }: Props = $props();

  const LINK_COLOUR = chrome.muted;
  const HALO = chrome.surface;

  type SimNode = ClusterNode & SimulationNodeDatum;
  type SimLink = SimulationLinkDatum<SimNode> & { primary: boolean };

  let container: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let simulation: Simulation<SimNode, SimLink> | null = null;
  let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let layer: Selection<SVGGElement, unknown, null, undefined> | null = null;

  let selectedId = $state<string | null>(null);
  let hoverLabel = $state<string | null>(null);

  /**
   * Restyles the current render for the active selection without touching the
   * simulation. Re-rendering on selection would rebuild the layout and make every
   * node visibly resettle.
   */
  let reapplyEmphasis: (() => void) | null = null;

  function setSelection(id: string | null) {
    selectedId = id;
    reapplyEmphasis?.();
  }

  function endpointId(end: string | SimNode | number): string {
    if (typeof end === 'string') return end;
    if (typeof end === 'number') return String(end);
    return end.id;
  }

  /**
   * Works out which hub each spoke belongs to.
   *
   * A link with exactly one hub endpoint assigns the other end to that hub. Spokes
   * joined only to other spokes then inherit, so a chain like
   * hub → spoke → spoke lands entirely in one cluster.
   */
  function buildClusters(ns: SimNode[], ls: SimLink[]): Map<string, string> {
    const isHub = new Map(ns.map((n) => [n.id, n.hub]));
    const cluster = new Map<string, string>();

    ls.forEach((l) => {
      const s = endpointId(l.source);
      const t = endpointId(l.target);
      const sHub = isHub.get(s);
      const tHub = isHub.get(t);
      if (sHub && !tHub && !cluster.has(t)) cluster.set(t, s);
      if (tHub && !sHub && !cluster.has(s)) cluster.set(s, t);
    });

    // Two passes is enough for the depths in use; more would be wasted work.
    for (let pass = 0; pass < 2; pass++) {
      ls.forEach((l) => {
        const s = endpointId(l.source);
        const t = endpointId(l.target);
        if (isHub.get(s) || isHub.get(t)) return;
        if (cluster.has(s) && !cluster.has(t)) cluster.set(t, cluster.get(s)!);
        if (cluster.has(t) && !cluster.has(s)) cluster.set(s, cluster.get(t)!);
      });
    }

    return cluster;
  }

  function render() {
    if (!layer || !svgEl) return;

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = links.map((l) => ({ ...l }));

    const w = container?.clientWidth || 900;
    const h = height;

    simulation?.stop();
    layer.selectAll('*').remove();

    const clusterOf = buildClusters(simNodes, simLinks);
    const hubs = simNodes.filter((n) => n.hub);

    const unassigned = simNodes.filter((n) => !n.hub && !clusterOf.has(n.id));

    // Reserve a band on the right for nodes that belong to no cluster, sized to
    // how much actually lives in it. A fixed narrow band forced dozens of nodes
    // into a single column and made the whole graph read as vertical.
    const PAD = 24;
    // With no hubs at all there is nothing to sit beside, so the "band" is the
    // whole canvas. Reserving a sliver on the right in that case crushed every
    // node into a vertical strip.
    const bandFraction =
      unassigned.length === 0
        ? 0
        : hubs.length === 0
          ? 1
          : Math.min(0.28, Math.max(0.1, unassigned.length / Math.max(simNodes.length, 1)));
    const clusterWidth = w * (1 - bandFraction);

    // Columns follow the shape of the available area, so a wide canvas gets a
    // wide grid rather than a square one.
    const hubCount = Math.max(hubs.length, 1);
    const columns = Math.max(
      1,
      Math.min(hubCount, Math.round(Math.sqrt(hubCount * (clusterWidth / Math.max(h, 1)))))
    );
    const rows = Math.max(1, Math.ceil(hubCount / columns));
    const centres = new Map<string, { x: number; y: number }>();

    hubs.forEach((hub, i) => {
      centres.set(hub.id, {
        x: (((i % columns) + 0.5) / columns) * (clusterWidth - PAD * 2) + PAD,
        y: ((Math.floor(i / columns) + 0.5) / rows) * (h - PAD * 2) + PAD,
      });
    });

    // The band gets its own grid for the same reason the clusters do.
    const bandLeft = hubs.length === 0 ? PAD : clusterWidth + 8;
    const bandWidth = Math.max(60, w - bandLeft - PAD);
    const bandCount = Math.max(unassigned.length, 1);
    const bandCols = Math.max(1, Math.round(Math.sqrt(bandCount * (bandWidth / Math.max(h, 1)))));
    const bandRows = Math.max(1, Math.ceil(bandCount / bandCols));
    const bandPos = new Map<string, { x: number; y: number }>();

    unassigned.forEach((n, i) => {
      bandPos.set(n.id, {
        x: bandLeft + (((i % bandCols) + 0.5) / bandCols) * bandWidth,
        y: ((Math.floor(i / bandCols) + 0.5) / bandRows) * (h - PAD * 2) + PAD,
      });
    });

    function targetX(d: SimNode): number {
      if (d.hub) return centres.get(d.id)?.x ?? clusterWidth / 2;
      const c = clusterOf.get(d.id);
      if (c) return centres.get(c)?.x ?? clusterWidth / 2;
      return bandPos.get(d.id)?.x ?? w - bandWidth / 2;
    }

    function targetY(d: SimNode): number {
      if (d.hub) return centres.get(d.id)?.y ?? h / 2;
      const c = clusterOf.get(d.id);
      if (c) return centres.get(c)?.y ?? h / 2;
      return bandPos.get(d.id)?.y ?? h / 2;
    }

    const linkSel = layer
      .append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', LINK_COLOUR)
      .attr('stroke-opacity', (l) => (l.primary ? 0.5 : 0.28))
      .attr('stroke-width', (l) => (l.primary ? 1.2 : 0.7));

    const nodeSel = layer
      .append('g')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.colour)
      .attr('stroke', (d) => (d.flagged ? d.colour : HALO))
      .attr('stroke-width', (d) => (d.flagged ? 2 : 1.2))
      .attr('stroke-dasharray', (d) => (d.flagged ? '2,2' : null))
      .attr('cursor', 'pointer');

    // A white halo keeps labels readable wherever they land, including on top of
    // a dark node.
    function styleLabel(sel: Selection<SVGTextElement, SimNode, SVGGElement, unknown>) {
      return sel
        .attr('fill', chrome.ink)
        .attr('stroke', HALO)
        .attr('paint-order', 'stroke')
        .attr('stroke-linejoin', 'round')
        .attr('text-anchor', 'start')
        .attr('dy', 3.5)
        .attr('pointer-events', 'none');
    }

    const hubLabels = styleLabel(
      layer
        .append('g')
        .selectAll<SVGTextElement, SimNode>('text')
        .data(simNodes.filter((n) => n.hub))
        .join('text')
        .text((d) => d.label)
    )
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .attr('stroke-width', 3.5)
      .attr('dx', (d) => d.radius + 5);

    const spokeLabels = styleLabel(
      layer
        .append('g')
        .selectAll<SVGTextElement, SimNode>('text')
        .data(simNodes.filter((n) => !n.hub))
        .join('text')
        .text((d) => d.label)
    )
      .attr('font-size', 9.5)
      .attr('font-weight', 500)
      .attr('stroke-width', 3)
      .attr('dx', (d) => d.radius + 4)
      .attr('opacity', 0);

    nodeSel
      .on('mouseenter', (_event, d) => {
        hoverLabel = d.detail ? `${d.label} · ${d.detail}` : d.label;
      })
      .on('mouseleave', () => {
        hoverLabel = null;
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelection(selectedId === d.id ? null : d.id);
      });

    nodeSel.call(
      drag<SVGCircleElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation?.alphaTarget(0.25).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation?.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    function applyEmphasis() {
      if (!selectedId) {
        nodeSel.attr('opacity', 1);
        hubLabels.attr('opacity', 1);
        spokeLabels.attr('opacity', 0);
        linkSel.attr('stroke-opacity', (l) => (l.primary ? 0.5 : 0.28));
        return;
      }

      const keep = new Set<string>([selectedId]);
      simLinks.forEach((l) => {
        const s = endpointId(l.source);
        const t = endpointId(l.target);
        if (s === selectedId) keep.add(t);
        if (t === selectedId) keep.add(s);
      });

      nodeSel.attr('opacity', (d) => (keep.has(d.id) ? 1 : 0.08));
      hubLabels.attr('opacity', (d) => (keep.has(d.id) ? 1 : 0.08));
      // Only the selected node is named on canvas; the rest of the neighbourhood
      // is listed in the panel, where it can actually be read.
      spokeLabels.attr('opacity', (d) => (d.id === selectedId ? 1 : 0));
      linkSel.attr('stroke-opacity', (l) => {
        const s = endpointId(l.source);
        const t = endpointId(l.target);
        return s === selectedId || t === selectedId ? 0.9 : 0.02;
      });
    }

    simulation = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => (l.primary ? 34 : 22))
          .strength(0.5)
      )
      // Capped repulsion: unbounded charge pushed clusters far enough apart that
      // the graph spilled well outside the canvas.
      .force('charge', forceManyBody().strength(-38).distanceMax(160))
      .force('x', forceX<SimNode>(targetX).strength(0.6))
      .force('y', forceY<SimNode>(targetY).strength(0.6))
      .force('collide', forceCollide<SimNode>((d) => d.radius + 1.5).strength(0.9))
      .on('tick', () => {
        // Keep every node inside the canvas. Without this the layout overflowed
        // vertically and nodes were simply clipped.
        for (const d of simNodes) {
          const r = d.radius + 1;
          d.x = Math.max(r, Math.min(w - r, d.x ?? w / 2));
          d.y = Math.max(r, Math.min(h - r, d.y ?? h / 2));
        }

        linkSel
          .attr('x1', (l) => (l.source as SimNode).x ?? 0)
          .attr('y1', (l) => (l.source as SimNode).y ?? 0)
          .attr('x2', (l) => (l.target as SimNode).x ?? 0)
          .attr('y2', (l) => (l.target as SimNode).y ?? 0);

        nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
        hubLabels.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0);
        spokeLabels.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0);
      });

    reapplyEmphasis = applyEmphasis;
    applyEmphasis();
  }

  function resetView() {
    if (zoomBehavior && svgEl) {
      d3Select(svgEl).call(zoomBehavior.transform, zoomIdentity);
    }
    selectedId = null;
    render();
  }

  onMount(() => {
    const svg = d3Select(svgEl);
    layer = svg.append('g');

    zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (event) => {
        layer?.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehavior);
    svg.on('click', () => {
      if (selectedId !== null) setSelection(null);
    });

    const ro = new ResizeObserver(() => render());
    ro.observe(container);

    return () => {
      ro.disconnect();
      simulation?.stop();
    };
  });

  $effect(() => {
    // Depend on the data only. `render` reads `selectedId`, which would otherwise
    // make selection a dependency and rebuild the layout on every click.
    void nodes;
    void links;
    void height;
    if (layer) untrack(() => render());
  });

  // --- selection panel -------------------------------------------------------

  let selectedNode = $derived(
    selectedId ? (nodes.find((n) => n.id === selectedId) ?? null) : null
  );

  /**
   * The graph itself is pointer-only, so every node is also reachable from a
   * labelled dropdown. Choosing one selects it exactly as a click would, and
   * the panel lists what it connects to.
   */
  let nodeGroups = $derived.by(() => {
    const groups = new Map<string, ClusterNode[]>();
    nodes.forEach((n) => {
      const list = groups.get(n.group) ?? [];
      list.push(n);
      groups.set(n.group, list);
    });
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, list]) => ({ group, list: list.sort((a, b) => a.label.localeCompare(b.label)) }));
  });

  let graphSummary = $derived(
    `${title}. ${nodes.length} items and ${links.length} connections. ` +
      'Use the Find control to choose an item and list its connections.'
  );

  let neighbours = $derived.by(() => {
    if (!selectedId) return [] as ClusterNode[];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const ids = new Set<string>();
    links.forEach((l) => {
      if (l.source === selectedId) ids.add(l.target);
      if (l.target === selectedId) ids.add(l.source);
    });
    return [...ids]
      .map((id) => byId.get(id))
      .filter((n): n is ClusterNode => Boolean(n))
      .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  });
</script>

<div class="bg-base-100 p-4 border border-base-300">
  <div class="flex items-center justify-between gap-x-6 gap-y-2 flex-wrap mb-1.5">
    <h3 class="font-semibold text-sm shrink-0">{title}</h3>

    <div class="flex items-center gap-x-4 gap-y-2 text-xs flex-wrap">
      {#each legend as entry (entry.label)}
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0" style="background:{entry.colour}" aria-hidden="true"></span>
          {entry.label}
        </span>
      {/each}

      {#if controls}
        <span class="w-px h-4 bg-base-300"></span>
        {@render controls()}
      {/if}

      {#if nodes.length > 0}
        <label class="flex items-center gap-1.5">
          <span class="font-medium">Find</span>
          <select
            class="select select-xs select-bordered max-w-48"
            value={selectedId ?? ''}
            onchange={(e) => setSelection((e.currentTarget as HTMLSelectElement).value || null)}
          >
            <option value="">Choose an item</option>
            {#each nodeGroups as g (g.group)}
              <optgroup label={g.group}>
                {#each g.list as n (n.id)}
                  <option value={n.id}>{n.label}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        </label>
      {/if}

      <button type="button" class="btn btn-xs btn-ghost" onclick={resetView}>Reset view</button>
    </div>
  </div>

  <p class="text-xs opacity-70 mb-2">{caption}</p>

  <div bind:this={container} class="relative w-full" style="height: {height}px">
    <svg bind:this={svgEl} class="w-full h-full block" role="img" aria-label={graphSummary}></svg>

    {#if hoverLabel && !selectedNode}
      <div class="absolute top-2 left-2 px-2 py-1 text-xs bg-base-200 border border-base-300 pointer-events-none max-w-[60%] truncate">
        {hoverLabel}
      </div>
    {/if}

    {#if selectedNode}
      <aside
        aria-label="Connections of {selectedNode.label}"
        class="absolute top-2 right-2 bottom-2 w-72 max-w-[45%] bg-base-100 border border-base-300 flex flex-col"
        style="border-radius: var(--r-card)"
      >
        <div class="flex items-start justify-between gap-2 p-3 border-b border-base-300">
          <div class="min-w-0">
            <p class="text-sm font-semibold leading-tight break-words">{selectedNode.label}</p>
            <p class="text-xs opacity-70 mt-0.5">
              {selectedNode.detail ?? selectedNode.group}
            </p>
          </div>
          <button
            type="button"
            class="btn btn-xs btn-ghost btn-square shrink-0"
            aria-label="Clear selection"
            onclick={() => setSelection(null)}
          ><X size={14} aria-hidden="true" /></button>
        </div>

        <div class="px-3 py-2 text-xs opacity-70 border-b border-base-300">
          {neighbours.length} connected {neighbours.length === 1 ? 'item' : 'items'}
        </div>

        <ul class="flex-1 overflow-y-auto p-1 m-0 list-none">
          {#each neighbours as n (n.id)}
            <li>
              <button
                type="button"
                class="w-full text-left flex items-start gap-2 px-2 py-1.5 hover:bg-base-200 text-xs"
                style="border-radius: var(--r-ctl)"
                onclick={() => setSelection(n.id)}
              >
                <span class="inline-block w-2 h-2 rounded-full mt-1 shrink-0" style="background:{n.colour}" aria-hidden="true"></span>
                <span class="min-w-0 break-words">{n.label}</span>
              </button>
            </li>
          {/each}
        </ul>
      </aside>
    {/if}

    {#if nodes.length === 0}
      <div class="absolute inset-0 grid place-content-center text-sm opacity-70">
        {emptyMessage}
      </div>
    {/if}
  </div>
</div>
