<script lang="ts">
  import { TriangleAlert } from 'lucide-svelte';

  /**
   * A failed load, said plainly, with a way to try again. Announced on arrival
   * so a screen reader user learns the page is incomplete.
   */
  interface Props {
    message: string | null;
    onRetry?: () => void;
  }

  let { message, onRetry }: Props = $props();
</script>

{#if message}
  <div role="alert" class="alert alert-warning text-sm">
    <TriangleAlert size={16} aria-hidden="true" />
    <span>{message}</span>
    {#if onRetry}
      <button type="button" class="btn btn-sm" onclick={onRetry}>Try again</button>
    {/if}
  </div>
{/if}
