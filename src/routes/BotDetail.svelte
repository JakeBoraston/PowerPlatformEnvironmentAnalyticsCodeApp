<script lang="ts">
  import { bots, botsLoading, botsError, fetchBots } from '$lib/stores/botStore';
  import {
    componentsByBot, getComponentTypeLabel,
    isTopic, isKnowledgeSource, isSystemTopic, parseKnowledgeSource,
    isGptComponent, parseAgentGpt,
  } from '$lib/stores/botComponentStore';
  import { conversations, conversationsLoading, conversationsError, fetchConversations } from '$lib/stores/conversationStore';
  import { botComponentsLoading, botComponentsError, fetchBotComponents } from '$lib/stores/botComponentStore';
  import { userNameMap, resolveOwnerName } from '$lib/stores/userStore';
  import { getAgentUrl } from '$lib/stores/powerContext';
  import { formatDate, formatDateTime } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import ActivityHeatmap from '$lib/components/charts/ActivityHeatmap.svelte';
  import { Bot, BookOpen, Brain, MessageSquare, Puzzle, CircleDot } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import ExternalLinkButton from '$lib/components/ui/ExternalLinkButton.svelte';

  let { params = {} } = $props<{ params?: { id?: string } }>();

  let botId = $derived(params.id ?? '');
  let bot = $derived($bots.find((b) => b.botid === botId));
  let nameMap = $derived($userNameMap);
  let owner = $derived(bot ? resolveOwnerName(bot as any, nameMap) : '—');
  let isActive = $derived(bot?.statecode === 0);

  // Components for this agent
  let comps = $derived($componentsByBot.get(botId) ?? []);
  let topicCount = $derived(comps.filter(isTopic).length);
  let knowledgeCount = $derived(comps.filter(isKnowledgeSource).length);

  /** Author-created topics first — the system ones are noise when scanning. */
  let topics = $derived(
    comps.filter(isTopic).sort((a, b) => {
      const sys = Number(isSystemTopic(a)) - Number(isSystemTopic(b));
      return sys !== 0 ? sys : (a.name ?? '').localeCompare(b.name ?? '');
    })
  );

  let knowledgeSources = $derived(
    comps
      .filter(isKnowledgeSource)
      .map((component) => ({ component, info: parseKnowledgeSource(component) }))
      .sort((a, b) => (a.component.name ?? '').localeCompare(b.component.name ?? ''))
  );

  // Instructions and conversation starters come from the generative-AI component.
  let gpt = $derived.by(() => {
    const component = comps.find(isGptComponent);
    return component ? parseAgentGpt(component) : { instructions: null, conversationStarters: [] };
  });

  /** SharePoint paths are percent-encoded and long; show the readable tail. */
  function prettyLocation(url: string): string {
    try {
      const decoded = decodeURIComponent(url);
      const { host, pathname } = new URL(decoded);
      return `${host}${pathname}`;
    } catch {
      return url;
    }
  }

  let compByType = $derived.by(() => {
    const m = new Map<string, number>();
    comps.forEach((c) => {
      const label = getComponentTypeLabel(c.componenttype as unknown as number);
      m.set(label, (m.get(label) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  });

  // Conversations for this agent (last 28 days — fetched window)
  let botConversations = $derived(
    $conversations.filter(
      (c) => ((c as any)._bot_conversationtranscriptid_value ?? '') === botId,
    ),
  );
  let conversationCount = $derived(botConversations.length);

  // Map to the heatmap's expected shape ({ starttime })
  let conversationRuns = $derived(
    botConversations.map((c) => ({ starttime: c.conversationstarttime })),
  );

  let recentConversations = $derived(
    [...botConversations].sort(
      (a, b) =>
        new Date(b.conversationstarttime ?? '').getTime() -
        new Date(a.conversationstarttime ?? '').getTime(),
    ),
  );

  let agentUrl = $derived(getAgentUrl(botId));

  let isLoading = $derived($botsLoading || $botComponentsLoading);
  let error = $derived($botsError ?? $botComponentsError ?? $conversationsError);

  let subtitle = $derived(
    [
      owner !== '—' ? `Owned by ${owner}` : '',
      bot?.createdon ? `Created ${formatDate(bot.createdon)}` : '',
      bot?.publishedon ? `Published ${formatDate(bot.publishedon)}` : '',
    ].filter(Boolean).join(' \u00b7 ')
  );

  function reload() {
    fetchBots();
    fetchBotComponents();
    fetchConversations();
  }
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title={bot?.name ?? bot?.schemaname ?? (isLoading ? 'Loading agent' : 'Agent not found')}
    {subtitle}
    backTo="/agents"
    backLabel="Back to agents"
    refreshLabel="this agent"
    refreshing={isLoading}
    onRefresh={reload}
  >
    {#snippet meta()}
      {#if bot}
        <Bot size={18} class="text-primary" aria-hidden="true" />
        <span class="pa-pill {isActive ? 'pa-pill--ok' : 'pa-pill--idle'}">
          {bot.statuscodename ?? (isActive ? 'Active' : 'Draft')}
        </span>
      {/if}
    {/snippet}
    {#snippet actions()}
      <ExternalLinkButton href={agentUrl} label="Open this agent in Copilot Studio" text="Open in Copilot Studio" size="sm" variant="primary" />
    {/snippet}
  </PageHeader>

  <LoadError message={error} onRetry={reload} />

  {#if isLoading && !bot}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading agent" />
    </div>
  {:else if !bot}
    <div class="pa-card text-sm">
      <p>No agent with this ID exists in this environment. It may have been deleted, or the link came from another environment.</p>
      <a href="#/agents" class="link mt-2 inline-block">View all agents</a>
    </div>
  {:else}
  <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
    <KpiCard label="Topics" value={topicCount} icon={BookOpen} />
    <KpiCard label="Knowledge Sources" value={knowledgeCount} icon={Brain} />
    <KpiCard label="Components" value={comps.length} icon={Puzzle} />
    <KpiCard label="Conversations (28d)" value={$conversationsLoading ? '…' : $conversationsError ? '—' : conversationCount} icon={MessageSquare} />
    <KpiCard label="Status" value={isActive ? 'Active' : 'Draft'} icon={CircleDot} />
  </div>

  <!-- How the agent is configured: what it was told to do, and how it opens -->
  {#if gpt.instructions || gpt.conversationStarters.length > 0}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {#if gpt.instructions}
        <div class="lg:col-span-2">
          <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider mb-4">Instructions</h2>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="pa-card max-h-80 overflow-y-auto pa-scroll" tabindex="0" role="region" aria-label="Instructions">
            <p class="text-sm whitespace-pre-wrap leading-relaxed">{gpt.instructions}</p>
          </div>
        </div>
      {/if}

      {#if gpt.conversationStarters.length > 0}
        <div class={gpt.instructions ? '' : 'lg:col-span-3'}>
          <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider mb-4">
            Conversation Starters ({gpt.conversationStarters.length})
          </h2>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="flex flex-col gap-2 max-h-80 overflow-y-auto pa-scroll" tabindex="0" role="region" aria-label="Conversation starters">
            {#each gpt.conversationStarters as starter (starter.title)}
              <div class="pa-card">
                <p class="text-sm font-semibold">{starter.title}</p>
                {#if starter.text}
                  <p class="text-xs text-base-content/70 mt-1">{starter.text}</p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <ActivityHeatmap runs={conversationRuns} title="When This Agent Is Used: Day & Hour" />

  <!-- What this agent actually knows and does -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div>
      <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider mb-4">Topics ({topics.length})</h2>
      {#if topics.length === 0}
        <p class="text-sm text-base-content/70 py-4">No topics found for this agent.</p>
      {:else}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="overflow-y-auto border border-base-300 pa-scroll pa-table-region" style="border-radius: var(--r-card)" tabindex="0" role="region" aria-label="Topics">
          <table class="table table-sm w-full">
            <thead class="sr-only"><tr><th>Topic</th></tr></thead>
            <tbody>
              {#each topics as topic (topic.botcomponentid)}
                <tr class="hover:bg-base-200 transition-colors">
                  <td>
                    <div class="flex items-start gap-2">
                      <span class="font-medium text-sm">{topic.name || 'Unnamed topic'}</span>
                      {#if isSystemTopic(topic)}
                        <span class="pa-pill pa-pill--idle shrink-0">System</span>
                      {/if}
                    </div>
                    {#if topic.description}
                      <p class="text-xs text-base-content/70 mt-0.5">{topic.description}</p>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div>
      <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider mb-4">Knowledge Sources ({knowledgeSources.length})</h2>
      {#if knowledgeSources.length === 0}
        <p class="text-sm text-base-content/70 py-4">No knowledge sources configured.</p>
      {:else}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="overflow-y-auto overflow-x-auto border border-base-300 pa-scroll pa-table-region" style="border-radius: var(--r-card)" tabindex="0" role="region" aria-label="Knowledge sources">
          <table class="table table-sm w-full">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Location</th></tr>
            </thead>
            <tbody>
              {#each knowledgeSources as source (source.component.botcomponentid)}
                <tr class="hover:bg-base-200 transition-colors">
                  <td>
                    <span class="font-medium text-sm">{source.component.name || 'Unnamed'}</span>
                    {#if source.component.description}
                      <p class="text-xs text-base-content/70 mt-0.5">{source.component.description}</p>
                    {/if}
                  </td>
                  <td class="text-xs whitespace-nowrap">{source.info.kind}</td>
                  <td class="text-xs max-w-xs">
                    {#if source.info.location}
                      {#if source.info.location.startsWith('http')}
                        <a href={source.info.location} target="_blank" rel="noopener noreferrer"
                           class="break-all" title={source.info.location}>{prettyLocation(source.info.location)}<span class="sr-only"> (opens in a new tab)</span></a>
                      {:else}
                        <span class="break-all text-base-content/70">{source.info.location}</span>
                      {/if}
                    {:else}
                      <span class="text-base-content/70">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Component breakdown -->
    <div class="lg:col-span-1">
      <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider mb-4">Components</h2>
      {#if compByType.length === 0}
        <p class="text-sm text-base-content/70 py-4">No components found for this agent.</p>
      {:else}
        <table class="table table-sm w-full">
          <thead class="sr-only"><tr><th>Component type</th><th>Count</th></tr></thead>
          <tbody>
            {#each compByType as [label, count]}
              <tr class="hover:bg-base-200 transition-colors">
                <td class="text-sm">{label}</td>
                <td class="text-right font-semibold">{count}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <!-- Recent conversations -->
    <div class="lg:col-span-2">
      <h2 class="pa-h3 text-sm font-bold uppercase tracking-wider mb-4">Recent Conversations (28d)</h2>
      {#if recentConversations.length === 0}
        <p class="text-sm text-base-content/70 py-4">No conversations recorded in the last 28 days.</p>
      {:else}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Recent conversations">
          <table class="table table-sm w-full">
            <thead class="sticky top-0 bg-base-100">
              <tr>
                <th>Conversation</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {#each recentConversations.slice(0, 100) as conv (conv.conversationtranscriptid)}
                <tr class="hover:bg-base-200 transition-colors">
                  <td class="text-xs">{conv.name ?? conv.conversationtranscriptid}</td>
                  <td class="text-xs">{conv.conversationstarttime ? formatDateTime(conv.conversationstarttime) : '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
  {/if}
</div>
