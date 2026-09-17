<script lang="ts">
  import { Search } from 'lucide-svelte';

  /** Search box with a visible label. The placeholder is a hint, never the label. */
  interface Props {
    label?: string;
    placeholder?: string;
    value: string;
  }

  let { label = 'Search', placeholder = '', value = $bindable() }: Props = $props();
</script>

<label class="flex flex-col gap-1 min-w-0 w-full sm:w-auto">
  <span class="text-xs font-medium text-base-content/70">{label}</span>
  <span class="input input-sm input-bordered flex items-center gap-2 w-full sm:w-64">
    <Search size={14} class="text-base-content/70 shrink-0" aria-hidden="true" />
    <input type="search" {placeholder} class="grow min-w-0" bind:value />
  </span>
</label>
