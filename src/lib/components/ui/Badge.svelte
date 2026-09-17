<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A small status or category label. Self-contained, so the app carries no
   * shared component library dependency.
   */
  type Variant = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'primary';

  interface Props {
    variant?: Variant;
    class?: string;
    children: Snippet;
  }

  let { variant = 'neutral', class: extra = '', children }: Props = $props();

  const styles: Record<Variant, string> = {
    neutral: 'background: var(--sunken); color: var(--ink-2);',
    info: 'background: var(--primary-wash); color: var(--primary);',
    primary: 'background: var(--primary); color: var(--on-primary);',
    success: 'background: var(--ok-wash); color: var(--ok-ink);',
    warning: 'background: var(--warn-wash); color: var(--warn-ink);',
    error: 'background: var(--bad-wash); color: var(--bad-ink);',
  };
</script>

<span class="badge {extra}" style={styles[variant]}>{@render children()}</span>

<style>
  .badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.4;
    padding: 0.1875rem 0.625rem;
    border-radius: var(--r-tag);
    white-space: nowrap;
  }
</style>
