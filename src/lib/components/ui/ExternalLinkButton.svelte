<script lang="ts">
  import { ExternalLink } from 'lucide-svelte';

  /**
   * A link out to a maker portal. The deep-link helpers return '#' when the
   * environment ID isn't known, and a live '#' link would send the hash router
   * back to the dashboard, so that case renders as a disabled control instead.
   *
   * With `text` it is a labelled button; without it, an icon button named by
   * `label`.
   */
  interface Props {
    href: string;
    label: string;
    text?: string;
    size?: 'xs' | 'sm';
    variant?: 'ghost' | 'primary';
    onclick?: (event: MouseEvent) => void;
  }

  let { href, label, text, size = 'xs', variant = 'ghost', onclick }: Props = $props();

  let available = $derived(Boolean(href) && href !== '#');
  let classes = $derived(
    [
      'btn',
      size === 'xs' ? 'btn-xs' : 'btn-sm',
      variant === 'primary' ? 'btn-primary' : 'btn-ghost text-primary',
      text ? 'gap-2' : 'btn-square',
    ].join(' ')
  );
  let iconSize = $derived(size === 'xs' ? 14 : 16);
</script>

{#if available}
  <a
    {href}
    target="_blank"
    rel="noopener noreferrer"
    class={classes}
    title={label}
    aria-label={text ? undefined : `${label} (opens in a new tab)`}
    {onclick}
  >
    <ExternalLink size={iconSize} aria-hidden="true" />
    {#if text}
      {text}
      <span class="sr-only">(opens in a new tab)</span>
    {/if}
  </a>
{:else}
  <span
    class="{classes} btn-disabled"
    role="link"
    aria-disabled="true"
    aria-label={`${label} (unavailable: environment not identified)`}
    title="Unavailable: the environment could not be identified"
  >
    <ExternalLink size={iconSize} aria-hidden="true" />
    {#if text}{text}{/if}
  </span>
{/if}
