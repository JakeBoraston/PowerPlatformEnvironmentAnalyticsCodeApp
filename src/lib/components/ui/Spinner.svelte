<script lang="ts">
  /**
   * Local replacement for the shared library's Spinner. Prefer a skeleton for
   * content with a known shape; this is for genuinely indeterminate waits.
   */
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    class?: string;
    label?: string;
  }

  let { size = 'md', class: extra = '', label = 'Loading' }: Props = $props();

  const dimensions: Record<string, string> = {
    sm: '1rem',
    md: '1.5rem',
    lg: '2.25rem',
  };
</script>

<span
  class="spinner {extra}"
  style="--d: {dimensions[size]}"
  role="status"
  aria-label={label}
></span>

<style>
  .spinner {
    display: inline-block;
    width: var(--d);
    height: var(--d);
    border-radius: 50%;
    border: 2px solid var(--line);
    border-top-color: var(--primary);
    animation: spin 700ms linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2.4s;
      border-top-color: var(--primary);
    }
  }
</style>
