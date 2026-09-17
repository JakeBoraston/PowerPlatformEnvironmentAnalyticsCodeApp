<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import { filterParam } from '$lib/utils/filterParam';
  import {
    bots, botsLoading, botsError, botCount,
    activeBots, draftBots, fetchBots
  } from '$lib/stores/botStore';
  import {
    botComponents, botComponentsLoading, botComponentsError,
    componentsByBot, componentsByType, topicCount, knowledgeSourceCount,
    getComponentTypeLabel
  } from '$lib/stores/botComponentStore';
  import {
    conversations, conversationsLoading, conversationsError, conversationCount, conversationsByBot
  } from '$lib/stores/conversationStore';
  import { userNameMap, resolveOwnerName, disabledOwnerIds, isOwnedByDisabledUser } from '$lib/stores/userStore';
  import { getAgentUrl } from '$lib/stores/powerContext';
  import { formatDate } from '$lib/utils/dateUtils';
  import ExternalLinkButton from '$lib/components/ui/ExternalLinkButton.svelte';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import DonutChart from '$lib/components/charts/DonutChart.svelte';
  import {
    Bot, CheckCircle, FileEdit, MessageSquare, BookOpen, Brain, Puzzle
  } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';
  import SortHeader from '$lib/components/ui/SortHeader.svelte';


  let isLoading = $derived($botsLoading);

  let componentSlices = $derived(
    [...$componentsByType.entries()].map(([label, value]) => ({ label, value }))
  );
  let error = $derived($botsError);
  let nameMap = $derived($userNameMap);

  function ownerOf(bot: any): string {
    return resolveOwnerName(bot, nameMap);
  }

  // --- Filters ---
  let searchQuery = $state('');
  let statusFilter = $state<'all' | 'active' | 'draft' | 'unpublished'>(
    filterParam($querystring, 'status', ['all', 'active', 'draft', 'unpublished'] as const, 'all')
  );
  let ownerFilter = $state<'all' | 'disabled'>(
    filterParam($querystring, 'owner', ['all', 'disabled'] as const, 'all')
  );

  let filteredBots = $derived(
    $bots.filter((bot) => {
      const name = (bot.name ?? bot.schemaname ?? '').toLowerCase();
      const owner = ownerOf(bot).toLowerCase();
      const q = searchQuery.toLowerCase();
      if (q && !name.includes(q) && !owner.includes(q)) return false;
      if (statusFilter === 'active' && bot.statecode !== 0) return false;
      if (statusFilter === 'draft' && bot.statecode === 0) return false;
      if (statusFilter === 'unpublished' && bot.publishedon) return false;
      if (ownerFilter === 'disabled' && !isOwnedByDisabledUser(bot as never, $disabledOwnerIds)) return false;
      return true;
    })
  );

  // Component counts per bot
  let compsByBot = $derived($componentsByBot);
  let convsByBot = $derived($conversationsByBot);

  function getTopicCountForBot(botId: string): number {
    const comps = compsByBot.get(botId) ?? [];
    return comps.filter((c) => c.componenttype === 0 || c.componenttype === 9).length;
  }

  function getKnowledgeCountForBot(botId: string): number {
    const comps = compsByBot.get(botId) ?? [];
    return comps.filter((c) => c.componenttype === 16).length;
  }

  function getConversationCountForBot(botId: string): number {
    return convsByBot.get(botId) ?? 0;
  }

  // --- Sort ---
  type SortField = 'name' | 'owner' | 'status' | 'topics' | 'knowledge' | 'conversations' | 'created' | 'published';
  let sortField = $state<SortField>('name');
  let sortAsc = $state(true);

  function toggleSort(field: SortField) {
    if (sortField === field) { sortAsc = !sortAsc; }
    else { sortField = field; sortAsc = true; }
  }


  let sortedBots = $derived(() => {
    const list = [...filteredBots];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = (a.name ?? a.schemaname ?? '').localeCompare(b.name ?? b.schemaname ?? ''); break;
        case 'owner': cmp = ownerOf(a).localeCompare(ownerOf(b)); break;
        case 'status': cmp = (a.statecode ?? 0) - (b.statecode ?? 0); break;
        case 'topics': cmp = getTopicCountForBot(a.botid) - getTopicCountForBot(b.botid); break;
        case 'knowledge': cmp = getKnowledgeCountForBot(a.botid) - getKnowledgeCountForBot(b.botid); break;
        case 'conversations': cmp = getConversationCountForBot(a.botid) - getConversationCountForBot(b.botid); break;
        case 'created': cmp = new Date(a.createdon ?? '').getTime() - new Date(b.createdon ?? '').getTime(); break;
        case 'published': cmp = new Date(a.publishedon ?? '').getTime() - new Date(b.publishedon ?? '').getTime(); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  });

</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Copilot Studio Agents"
    subtitle="All agents in this environment"
    refreshLabel="agents"
    refreshing={isLoading}
    onRefresh={() => fetchBots()}
  />

  <LoadError message={error} onRetry={() => fetchBots()} />
  <LoadError message={$botComponentsError} />
  <LoadError message={$conversationsError} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <!-- KPIs -->
    <div class="grid grid-cols-2 lg:grid-cols-6 gap-4">
      <KpiCard label="Total Agents" value={$botCount} icon={Bot} />
      <KpiCard label="Active" value={$activeBots.length} icon={CheckCircle} />
      <KpiCard label="Draft" value={$draftBots.length} icon={FileEdit} />
      <KpiCard label="Topics" value={$botComponentsLoading ? '…' : $botComponentsError ? '—' : $topicCount} icon={BookOpen} />
      <KpiCard label="Knowledge Sources" value={$botComponentsLoading ? '…' : $botComponentsError ? '—' : $knowledgeSourceCount} icon={Brain} />
      <KpiCard label="Conversations (28d)" value={$conversationsLoading ? '…' : $conversationsError ? '—' : $conversationCount} icon={MessageSquare} />
    </div>

    <!-- Chart: Component breakdown -->
    {#if $botComponents.length > 0}
      <DonutChart
        title="Agent Components by Type"
        data={componentSlices}
        unit="components"
        categoryLabel="Component type"
      />
    {/if}

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search name or owner…" bind:value={searchQuery} />
      <FilterSelect
        label="Status"
        options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active only' }, { value: 'draft', label: 'Draft only' }, { value: 'unpublished', label: 'Never published' }]}
        bind:value={statusFilter}
      />
      <FilterSelect
        label="Owner"
        options={[{ value: 'all', label: 'All owners' }, { value: 'disabled', label: 'Disabled owners' }]}
        bind:value={ownerFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">{filteredBots.length} of {$botCount} agents</span>
    </div>

    {#if filteredBots.length === 0}
      <div class="text-center text-base-content/70 py-12">
        <p class="text-sm">No agents found.</p>
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Agents">
        <table class="table table-sm w-full">
          <thead>
            <tr>
              <SortHeader label="Agent Name" field="name" {sortField} {sortAsc} onsort={toggleSort} />
              <SortHeader label="Owner" field="owner" {sortField} {sortAsc} onsort={toggleSort} />
              <SortHeader label="Status" field="status" {sortField} {sortAsc} onsort={toggleSort} align="center" />
              <SortHeader label="Topics" field="topics" {sortField} {sortAsc} onsort={toggleSort} align="center" />
              <SortHeader label="Knowledge" field="knowledge" {sortField} {sortAsc} onsort={toggleSort} align="center" />
              <SortHeader label="Conversations" field="conversations" {sortField} {sortAsc} onsort={toggleSort} align="center" />
              <SortHeader label="Created" field="created" {sortField} {sortAsc} onsort={toggleSort} />
              <SortHeader label="Published" field="published" {sortField} {sortAsc} onsort={toggleSort} />
              <th class="text-center"><span class="sr-only">Open in Copilot Studio</span></th>
            </tr>
          </thead>
          <tbody>
            {#each sortedBots() as bot (bot.botid)}
              {@const agentUrl = getAgentUrl(bot.botid)}
              <tr class="hover:bg-base-200 transition-colors">
                <td class="font-medium">
                  <a href="#/agents/{bot.botid}" class="link link-hover text-base-content">{bot.name ?? bot.schemaname}</a>
                </td>
                <td class="text-sm">{ownerOf(bot)}</td>
                <td class="text-center">
                  <span class="pa-pill {bot.statecode === 0 ? 'pa-pill--ok' : 'pa-pill--idle'}">
                    {bot.statecodename ?? (bot.statecode === 0 ? 'Active' : 'Draft')}
                  </span>
                </td>
                <td class="text-center">{getTopicCountForBot(bot.botid)}</td>
                <td class="text-center">{getKnowledgeCountForBot(bot.botid)}</td>
                <td class="text-center">{getConversationCountForBot(bot.botid)}</td>
                <td class="text-xs text-base-content/70">
                  {bot.createdon ? formatDate(bot.createdon) : '—'}
                </td>
                <td class="text-xs text-base-content/70">
                  {bot.publishedon ? formatDate(bot.publishedon) : '—'}
                </td>
                <td class="text-center">
                  <ExternalLinkButton href={agentUrl} label="Open {bot.name ?? bot.schemaname} in Copilot Studio" />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
