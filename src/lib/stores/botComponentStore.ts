import { writable, derived } from 'svelte/store';
import { createLazyLoader } from './lazyLoad';
import { describeLoadError } from '$lib/utils/loadError';
import { readAll } from '$lib/utils/readPages';
import { BotcomponentsService } from '@services/BotcomponentsService';
import type { Botcomponents } from '@models/BotcomponentsModel';
import { getFormattedValue } from '$lib/utils/dataverse';

// --- Raw data stores ---
export const botComponents = writable<Botcomponents[]>([]);
export const botComponentsLoading = writable<boolean>(false);
export const botComponentsError = writable<string | null>(null);

// --- Component type labels ---
const componentTypeLabels: Record<number, string> = {
  0: 'Topic',
  1: 'Skill',
  2: 'Variable',
  3: 'Entity',
  4: 'Dialog',
  5: 'Trigger',
  6: 'Language Understanding',
  7: 'Language Generation',
  8: 'Dialog Schema',
  9: 'Topic (v2)',
  10: 'Translations',
  11: 'Entity (v2)',
  12: 'Variable (v2)',
  13: 'Skill (v2)',
  14: 'File Attachment',
  15: 'Custom GPT',
  16: 'Knowledge Source',
  17: 'External Trigger',
  18: 'Copilot Settings',
  19: 'Test Case',
};

export function getComponentTypeLabel(type: number): string {
  return componentTypeLabels[type] ?? `Type ${type}`;
}

// --- Derived stores ---
export const botComponentCount = derived(botComponents, ($c) => $c.length);

/** Components grouped by parent bot ID. */
export const componentsByBot = derived(botComponents, ($c) => {
  const map = new Map<string, Botcomponents[]>();
  $c.forEach((comp) => {
    const botId = (comp as any)._parentbotid_value ?? 'unlinked';
    const list = map.get(botId) ?? [];
    list.push(comp);
    map.set(botId, list);
  });
  return map;
});

/** Components grouped by type. */
export const componentsByType = derived(botComponents, ($c) => {
  const map = new Map<string, number>();
  $c.forEach((comp) => {
    const label = getComponentTypeLabel(comp.componenttype as unknown as number);
    map.set(label, (map.get(label) ?? 0) + 1);
  });
  return map;
});

/** Topic component types: 0 is the original shape, 9 the current one. */
export const TOPIC_TYPES = [0, 9];
export const KNOWLEDGE_SOURCE_TYPE = 16;

export function isTopic(component: Botcomponents): boolean {
  return TOPIC_TYPES.includes(component.componenttype as unknown as number);
}

export function isKnowledgeSource(component: Botcomponents): boolean {
  return (component.componenttype as unknown as number) === KNOWLEDGE_SOURCE_TYPE;
}

/**
 * Copilot Studio ships a set of system topics with every agent (On Error,
 * Conversation Start, and so on). They're rarely what someone means by "what
 * topics does this agent have", so they're marked rather than hidden.
 */
const SYSTEM_TOPIC_NAMES = new Set([
  'on error', 'conversation start', 'conversation end', 'escalate', 'end of conversation',
  'fallback', 'multiple topics matched', 'greeting', 'goodbye', 'thank you', 'start over',
  'signed in', 'sign in', 'reset conversation',
]);

export function isSystemTopic(component: Botcomponents): boolean {
  return SYSTEM_TOPIC_NAMES.has((component.name ?? '').trim().toLowerCase());
}

export interface KnowledgeSourceInfo {
  /** e.g. "SharePoint" — the `source.kind` from the component's YAML, tidied. */
  kind: string;
  /** Site URL, skill name, or whatever the source points at. */
  location: string | null;
}

const SOURCE_KIND_LABELS: Record<string, string> = {
  sharepointsearchsource: 'SharePoint',
  federatedstructuredsearchsource: 'Federated (structured)',
  federatedsearchsource: 'Federated',
  publicwebsitesource: 'Public website',
  dataversesearchsource: 'Dataverse',
  documentsource: 'Uploaded document',
  azureopenaisource: 'Azure OpenAI',
  graphconnectorsource: 'Graph connector',
};

/**
 * Knowledge source config lives in the component's `data` column as YAML, e.g.
 *
 *   kind: KnowledgeSourceConfiguration
 *   source:
 *     kind: SharePointSearchSource
 *     site: https://…
 *
 * Only the source kind and its location are needed, so this reads those two
 * directly rather than pulling in a YAML parser.
 */
export function parseKnowledgeSource(component: Botcomponents): KnowledgeSourceInfo {
  const raw = (component as unknown as { data?: string }).data ?? '';

  // The nested `kind:` under `source:` — the outer one is always
  // KnowledgeSourceConfiguration and tells us nothing.
  const kindMatch = raw.match(/^\s+kind:\s*(\S+)/m);
  const rawKind = kindMatch?.[1] ?? '';
  const kind = SOURCE_KIND_LABELS[rawKind.toLowerCase()]
    ?? (rawKind ? rawKind.replace(/Source$/, '') : 'Unknown');

  // Location key varies by source kind, so take the first one that appears.
  const locationMatch = raw.match(/^\s+(?:site|url|siteUrl|skillConfiguration|connectionId|path):\s*(.+)$/m);
  const location = locationMatch?.[1]?.trim() || null;

  return { kind, location };
}

/** The generative-AI settings component, which carries the agent's instructions. */
export const GPT_COMPONENT_TYPE = 15;

export function isGptComponent(component: Botcomponents): boolean {
  return (component.componenttype as unknown as number) === GPT_COMPONENT_TYPE;
}

export interface ConversationStarter {
  title: string;
  text: string;
}

export interface AgentGptInfo {
  /** The agent's instructions, as authored. Null when none are set. */
  instructions: string | null;
  conversationStarters: ConversationStarter[];
}

/**
 * Instructions and conversation starters live in the type-15 component's `data`
 * column as YAML:
 *
 *   kind: GptComponentMetadata
 *   instructions: |-
 *     - Should not automatically submit funding requests
 *     - Must not store or transmit client PII
 *   conversationStarters:
 *     - title: Eligibility Check
 *       text: What funding is available…
 *
 * `instructions` is a block scalar, so it runs until the indentation returns to a
 * top-level key. Read directly rather than adding a YAML parser.
 */
export function parseAgentGpt(component: Botcomponents): AgentGptInfo {
  const raw = (component as unknown as { data?: string }).data ?? '';
  const lines = raw.split(/\r?\n/);
  const isTopLevel = (line: string) => line.trim() !== '' && !/^\s/.test(line);

  let instructions: string | null = null;
  const conversationStarters: ConversationStarter[] = [];

  const instructionsAt = lines.findIndex((l) => /^instructions:\s*\|/.test(l));
  if (instructionsAt !== -1) {
    const body: string[] = [];
    for (let i = instructionsAt + 1; i < lines.length && !isTopLevel(lines[i]); i++) {
      body.push(lines[i]);
    }
    // Strip the common indent so the text reads as it was authored.
    const indents = body.filter((l) => l.trim() !== '').map((l) => l.match(/^\s*/)![0].length);
    const shift = indents.length ? Math.min(...indents) : 0;
    instructions = body.map((l) => l.slice(shift)).join('\n').trim() || null;
  }

  const startersAt = lines.findIndex((l) => /^conversationStarters:/.test(l));
  if (startersAt !== -1) {
    let current: Partial<ConversationStarter> = {};
    const flush = () => {
      if (current.title) conversationStarters.push({ title: current.title, text: current.text ?? '' });
    };

    for (let i = startersAt + 1; i < lines.length && !isTopLevel(lines[i]); i++) {
      const title = lines[i].match(/^\s*-\s*title:\s*(.+)$/);
      if (title) {
        flush();
        current = { title: title[1].trim() };
        continue;
      }
      const text = lines[i].match(/^\s*text:\s*(.+)$/);
      if (text) current.text = text[1].trim();
    }
    flush();
  }

  return { instructions, conversationStarters };
}

/** Topic count (type 0 + 9). */
export const topicCount = derived(botComponents, ($c) => $c.filter(isTopic).length);

/** Knowledge source count (type 16). */
export const knowledgeSourceCount = derived(botComponents, ($c) =>
  $c.filter(isKnowledgeSource).length
);

export async function fetchBotComponents(): Promise<void> {
  botComponentsLoading.set(true);
  botComponentsError.set(null);

  try {
    const rows = await readAll((options) => BotcomponentsService.getAll(options), {}, 'agent components');

    botComponents.set(rows);
  } catch (err) {
    botComponentsError.set(describeLoadError(err, 'agent components'));
  } finally {
    botComponentsLoading.set(false);
  }
}

/**
 * Loaded on demand by the routes that need it, and prefetched on nav hover.
 * See $lib/stores/dataRegistry.ts
 */
export const ensureBotComponentsLoaded = createLazyLoader(fetchBotComponents, botComponentsError);
