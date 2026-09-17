<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ArrowLeft, RefreshCw } from 'lucide-svelte';

  /**
   * The one heading block every route opens with. It owns the page's `h1`, the
   * back link on detail pages and the refresh control, so each of those is named
   * for assistive tech in one place rather than fifteen.
   */
  interface Props {
    title: string;
    subtitle?: string;
    /** Hash route for the back link on a detail page, e.g. `/flows`. */
    backTo?: string;
    backLabel?: string;
    /** What the refresh button reloads, read out as "Refresh {refreshLabel}". */
    refreshLabel?: string;
    refreshing?: boolean;
    onRefresh?: () => void;
    /** Sits beside the title: a status badge, an icon. */
    meta?: Snippet;
    /** Right-hand controls: time range, external links. */
    actions?: Snippet;
  }

  let {
    title,
    subtitle = '',
    backTo,
    backLabel = 'Back',
    refreshLabel = 'data',
    refreshing = false,
    onRefresh,
    meta,
    actions,
  }: Props = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
  <div class="flex items-start gap-2 min-w-0">
    {#if backTo}
      <a href="#{backTo}" class="btn btn-sm btn-ghost btn-square shrink-0" aria-label={backLabel}>
        <ArrowLeft size={16} aria-hidden="true" />
      </a>
    {/if}
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-xl font-bold uppercase tracking-wide m-0 break-words">{title}</h1>
        {@render meta?.()}
      </div>
      {#if subtitle}
        <p class="text-sm text-base-content/70 m-0">{subtitle}</p>
      {/if}
    </div>
  </div>

  {#if actions || onRefresh}
    <div class="flex flex-wrap items-end gap-3">
      {@render actions?.()}
      {#if onRefresh}
        <button
          type="button"
          class="btn btn-sm btn-ghost btn-square"
          onclick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh {refreshLabel}"
          aria-busy={refreshing}
          title="Refresh {refreshLabel}"
        >
          <RefreshCw size={14} class={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      {/if}
    </div>
  {/if}
</header>
