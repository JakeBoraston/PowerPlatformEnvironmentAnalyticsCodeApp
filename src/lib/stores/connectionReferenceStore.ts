import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { workflows } from './flowStore';
import { solutions } from './solutionStore';
import { ConnectionreferencesService } from '@services/ConnectionreferencesService';
import { SolutioncomponentsService } from '@services/SolutioncomponentsService';
import type { Connectionreferences } from '@models/ConnectionreferencesModel';
import type { Solutioncomponents } from '@models/SolutioncomponentsModel';
import type { Workflows } from '@models/WorkflowsModel';

/**
 * Resolves `solutioncomponent.componenttype` for connection references.
 *
 * This value is NOT a platform constant. It matches the `connectionreference`
 * table's ObjectTypeCode, which Dataverse assigns per environment — 10064 in our
 * DEV, 10150 in PROD. Hardcoding DEV's value made the solution lookup silently
 * return nothing everywhere else, so every reference showed as "not in a
 * solution" and the graph lost all its clusters.
 *
 * Rather than hardcode or call the metadata API, probe it: ask for the solution
 * components of a handful of references we already hold and read the type back
 * off whatever returns.
 */
async function resolveComponentType(
  refs: Connectionreferences[]
): Promise<number | null> {
  const sample = refs.slice(0, 10).map((r) => r.connectionreferenceid).filter(Boolean);
  if (sample.length === 0) return null;

  const filter = sample.map((id) => `objectid eq ${id}`).join(' or ');
  const result = await SolutioncomponentsService.getAll({
    select: ['componenttype'],
    filter,
    top: 25,
  });

  if (!result.success) return null;
  const first = (result.data ?? [])[0] as unknown as { componenttype?: number } | undefined;
  return typeof first?.componenttype === 'number' ? first.componenttype : null;
}

/**
 * Roll-up solutions that contain everything and therefore say nothing about
 * ownership.
 *
 * "Default" matters most here: Dataverse's Default Solution holds every
 * unmanaged component in the environment — all 183 references in DEV. Leaving it
 * in gave every reference an edge to one enormous hub, which is exactly why
 * nothing looked orphaned. The environment's own "Common Data Services Default
 * Solution" is the same story under a per-environment unique name, so it is
 * matched on its friendly name instead.
 */
const AGGREGATE_UNIQUE_NAMES = new Set(['active', 'basic', 'default']);
const AGGREGATE_FRIENDLY_NAMES = new Set(['common data services default solution']);

function isAggregateSolution(uniqueName: string, friendlyName: string): boolean {
  return (
    AGGREGATE_UNIQUE_NAMES.has(uniqueName.toLowerCase()) ||
    AGGREGATE_FRIENDLY_NAMES.has(friendlyName.toLowerCase())
  );
}

// --- Raw data stores ---
export const connectionReferences = writable<Connectionreferences[]>([]);
export const connectionReferenceComponents = writable<Solutioncomponents[]>([]);
export const connectionReferencesLoading = writable<boolean>(false);
export const connectionReferencesError = writable<string | null>(null);

// --- Helpers ---

/**
 * `connectorid` arrives as a provider path, e.g.
 * `/providers/Microsoft.PowerApps/apis/shared_sharepointonline`.
 */
export function connectorIdFromPath(path: string | undefined): string {
  if (!path) return 'unknown';
  const parts = path.split('/');
  return parts[parts.length - 1] || 'unknown';
}

/** `shared_sharepointonline` -> `Sharepointonline`. Good enough for a node label. */
export function connectorLabel(connectorId: string): string {
  const bare = connectorId.replace(/^shared_/, '');
  if (!bare) return connectorId;
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * Flows carry their connector bindings inside the `clientdata` JSON blob, under
 * `properties.connectionReferences`. Each entry names the connector API and the
 * logical name of the connection reference record that satisfies it.
 */
interface ClientDataBinding {
  connectorId: string;
  connectionReferenceLogicalName: string | null;
}

function parseFlowBindings(flow: Workflows): ClientDataBinding[] {
  const raw = (flow as unknown as { clientdata?: string }).clientdata;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const refs = parsed?.properties?.connectionReferences;
    if (!refs || typeof refs !== 'object') return [];

    return Object.keys(refs).reduce<ClientDataBinding[]>((acc, key) => {
      const node = refs[key];
      const connectorId = node?.api?.name ?? key;
      if (!connectorId) return acc;
      acc.push({
        connectorId,
        connectionReferenceLogicalName: node?.connection?.connectionReferenceLogicalName ?? null,
      });
      return acc;
    }, []);
  } catch {
    // A flow with unparseable clientdata simply contributes no edges.
    return [];
  }
}

// --- Derived: joins ---

export const connectionReferenceCount = derived(connectionReferences, ($c) => $c.length);

/** Lookup: connection reference logical name -> record. */
export const connectionReferenceByLogicalName = derived(connectionReferences, ($refs) => {
  const map = new Map<string, Connectionreferences>();
  $refs.forEach((r) => {
    if (r.connectionreferencelogicalname) {
      map.set(r.connectionreferencelogicalname.toLowerCase(), r);
    }
  });
  return map;
});

export interface OwningSolution {
  id: string;
  name: string;
}

/**
 * Connection reference id -> the solutions that contain it.
 *
 * A reference can legitimately live in more than one solution, so this keeps a
 * list rather than picking a winner.
 */
export const solutionsByReferenceId = derived(
  [connectionReferenceComponents, solutions],
  ([$components, $solutions]) => {
    const solutionById = new Map<string, { id: string; name: string; unique: string }>();
    $solutions.forEach((s) => {
      const friendly = s.friendlyname ?? s.uniquename ?? 'Unknown solution';
      const unique = s.uniquename ?? '';
      if (isAggregateSolution(unique, friendly)) return;
      solutionById.set(s.solutionid.toLowerCase(), {
        id: s.solutionid,
        name: friendly,
        unique: unique.toLowerCase(),
      });
    });

    const map = new Map<string, OwningSolution[]>();
    $components.forEach((component) => {
      const solutionId = (component as unknown as Record<string, unknown>)['_solutionid_value'];
      const objectId = component.objectid;
      if (typeof solutionId !== 'string' || typeof objectId !== 'string') return;

      // Aggregates were dropped when the lookup was built, so a miss here just
      // means the component belongs to one of them.
      const solution = solutionById.get(solutionId.toLowerCase());
      if (!solution) return;

      const key = objectId.toLowerCase();
      const list = map.get(key) ?? [];
      if (!list.some((s) => s.id === solution.id)) {
        list.push({ id: solution.id, name: solution.name });
      }
      map.set(key, list);
    });

    return map;
  }
);

/** Connection reference logical name -> ids of the flows that bind it. */
export const flowsByReferenceLogicalName = derived(workflows, ($flows) => {
  const map = new Map<string, Workflows[]>();
  $flows.forEach((flow) => {
    parseFlowBindings(flow).forEach((binding) => {
      if (!binding.connectionReferenceLogicalName) return;
      const key = binding.connectionReferenceLogicalName.toLowerCase();
      const list = map.get(key) ?? [];
      if (!list.some((f) => f.workflowid === flow.workflowid)) list.push(flow);
      map.set(key, list);
    });
  });
  return map;
});

// --- Graph ---

export type NodeKind = 'solution' | 'reference' | 'flow';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Reference nodes: friendly connector name. */
  connector: string;
  /** Reference nodes: how many flows bind it. */
  flowCount: number;
  /** Reference nodes: bound by no flow in this environment. */
  orphaned: boolean;
  /** Reference nodes: not a component of any real solution. */
  unsolutioned: boolean;
  /** Flow nodes: whether the flow is active. Solution nodes: always true. */
  active: boolean;
  /** Solution nodes: how many references it holds. */
  referenceCount: number;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: 'solution-reference' | 'reference-flow';
}

export interface ConnectionGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Solution -> connection reference -> flow.
 *
 * Connection references are the centre of the graph so that the ones nothing
 * binds are visible as nodes with no outgoing edge. The previous flow-to-connector
 * shape could not show them at all: an orphan has no flow to hang off.
 */
export const connectionGraph = derived(
  [connectionReferences, solutionsByReferenceId, flowsByReferenceLogicalName],
  ([$refs, $solutionsByRef, $flowsByRef]): ConnectionGraph => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const solutionNodes = new Map<string, GraphNode>();
    const flowNodes = new Map<string, GraphNode>();

    $refs.forEach((ref) => {
      const refNodeId = `ref:${ref.connectionreferenceid}`;
      const logical = (ref.connectionreferencelogicalname ?? '').toLowerCase();
      const boundFlows = logical ? ($flowsByRef.get(logical) ?? []) : [];
      const owningSolutions = $solutionsByRef.get(ref.connectionreferenceid.toLowerCase()) ?? [];

      nodes.push({
        id: refNodeId,
        kind: 'reference',
        label: ref.connectionreferencedisplayname ?? ref.connectionreferencelogicalname ?? 'Unnamed',
        connector: connectorLabel(connectorIdFromPath(ref.connectorid)),
        flowCount: boundFlows.length,
        orphaned: boundFlows.length === 0,
        unsolutioned: owningSolutions.length === 0,
        active: true,
        referenceCount: 0,
      });

      owningSolutions.forEach((solution) => {
        const solutionNodeId = `sol:${solution.id}`;
        let solutionNode = solutionNodes.get(solutionNodeId);
        if (!solutionNode) {
          solutionNode = {
            id: solutionNodeId,
            kind: 'solution',
            label: solution.name,
            connector: '',
            flowCount: 0,
            orphaned: false,
            unsolutioned: false,
            active: true,
            referenceCount: 0,
          };
          solutionNodes.set(solutionNodeId, solutionNode);
          nodes.push(solutionNode);
        }
        solutionNode.referenceCount++;
        links.push({ source: solutionNodeId, target: refNodeId, kind: 'solution-reference' });
      });

      boundFlows.forEach((flow) => {
        const flowNodeId = `flow:${flow.workflowid}`;
        if (!flowNodes.has(flowNodeId)) {
          const flowNode: GraphNode = {
            id: flowNodeId,
            kind: 'flow',
            label: flow.name,
            connector: '',
            flowCount: 0,
            orphaned: false,
            unsolutioned: false,
            active: flow.statecode === 1,
            referenceCount: 0,
          };
          flowNodes.set(flowNodeId, flowNode);
          nodes.push(flowNode);
        }
        links.push({ source: refNodeId, target: flowNodeId, kind: 'reference-flow' });
      });
    });

    return { nodes, links };
  }
);

// --- Derived: summaries ---

/** Connector usage, counted across connection references. */
export const connectorUsage = derived(
  [connectionReferences, flowsByReferenceLogicalName],
  ([$refs, $flowsByRef]) => {
    const counts = new Map<string, { id: string; label: string; refCount: number; flowCount: number }>();
    $refs.forEach((ref) => {
      const connectorId = connectorIdFromPath(ref.connectorid);
      const entry = counts.get(connectorId) ?? {
        id: connectorId,
        label: connectorLabel(connectorId),
        refCount: 0,
        flowCount: 0,
      };
      entry.refCount++;
      const logical = (ref.connectionreferencelogicalname ?? '').toLowerCase();
      entry.flowCount += logical ? ($flowsByRef.get(logical)?.length ?? 0) : 0;
      counts.set(connectorId, entry);
    });
    return [...counts.values()].sort((a, b) => b.flowCount - a.flowCount || b.refCount - a.refCount);
  }
);

/**
 * Connection references no flow binds to. Usually left behind when a flow is
 * deleted, and they still ride along in every solution import.
 */
export const orphanedConnectionReferences = derived(
  [connectionReferences, flowsByReferenceLogicalName],
  ([$refs, $flowsByRef]) =>
    $refs.filter((r) => {
      const logical = (r.connectionreferencelogicalname ?? '').toLowerCase();
      return !logical || ($flowsByRef.get(logical)?.length ?? 0) === 0;
    })
);

/** Connection references that belong to no real solution. */
export const unsolutionedConnectionReferences = derived(
  [connectionReferences, solutionsByReferenceId],
  ([$refs, $solutionsByRef]) =>
    $refs.filter((r) => ($solutionsByRef.get(r.connectionreferenceid.toLowerCase()) ?? []).length === 0)
);

/**
 * Flow bindings that name a connector but no connection reference — typically
 * older flows holding a direct connection. They can't appear in the graph, so
 * they're counted here instead of being silently dropped.
 */
export const directConnectionBindingCount = derived(workflows, ($flows) => {
  let count = 0;
  $flows.forEach((flow) => {
    parseFlowBindings(flow).forEach((b) => {
      if (!b.connectionReferenceLogicalName) count++;
    });
  });
  return count;
});

/**
 * Fetch connection references plus their solution memberships.
 *
 * Solution names come from `solutionStore`, so `/connections` also loads that —
 * see dataRegistry.
 */
export async function fetchConnectionReferences(): Promise<void> {
  connectionReferencesLoading.set(true);
  connectionReferencesError.set(null);

  try {
    const refs = await readAll(
      (options) => ConnectionreferencesService.getAll(options),
      {
      select: [
        'connectionreferenceid',
        'connectionreferencedisplayname',
        'connectionreferencelogicalname',
        'connectorid',
        'connectionid',
        'statecode',
        'ismanaged',
        'description',
        'createdon',
      ],
      orderBy: ['connectionreferencedisplayname asc'],
    },
      'connection references',
    );
    connectionReferences.set(refs);

    // The component type has to come from this environment, not a constant.
    const componentType = await resolveComponentType(refs);
    if (componentType === null) {
      connectionReferenceComponents.set([]);
      return;
    }

    const components = await readAll(
      (options) => SolutioncomponentsService.getAll(options),
      {
      select: ['solutioncomponentid', 'objectid', 'componenttype', '_solutionid_value'],
      filter: `componenttype eq ${componentType}`,
    },
      'solution components',
    );

    connectionReferenceComponents.set(components);
  } catch (err) {
    connectionReferencesError.set(describeLoadError(err, 'connection references'));
  } finally {
    connectionReferencesLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureConnectionReferencesLoaded = createLazyLoader(fetchConnectionReferences, connectionReferencesError);
