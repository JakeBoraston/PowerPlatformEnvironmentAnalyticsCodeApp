<script lang="ts" generics="T extends string">
  import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-svelte';

  /**
   * A sortable column heading. The control is a real button inside the `th`, so
   * it takes focus and responds to Enter and Space, and the `th` carries
   * `aria-sort` so a screen reader announces the current order.
   */
  interface Props {
    label: string;
    field: T;
    sortField: T;
    sortAsc: boolean;
    onsort: (field: T) => void;
    align?: 'start' | 'center' | 'end';
  }

  let { label, field, sortField, sortAsc, onsort, align = 'start' }: Props = $props();

  let active = $derived(sortField === field);
  let ariaSort = $derived<'ascending' | 'descending' | 'none'>(
    active ? (sortAsc ? 'ascending' : 'descending') : 'none'
  );
  const alignClass = { start: 'text-left', center: 'text-center', end: 'text-right' };
</script>

<th class={alignClass[align]} aria-sort={ariaSort}>
  <button type="button" class="pa-sort" onclick={() => onsort(field)}>
    {label}
    {#if !active}
      <ArrowUpDown size={12} class="opacity-70" aria-hidden="true" />
    {:else if sortAsc}
      <ArrowUp size={12} aria-hidden="true" />
    {:else}
      <ArrowDown size={12} aria-hidden="true" />
    {/if}
  </button>
</th>
