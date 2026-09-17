<script lang="ts" generics="T extends string | number">
  /** A labelled dropdown filter. Every select in the app goes through this. */
  interface Props {
    label: string;
    options: readonly { value: T; label: string }[];
    value: T;
    onchange?: (value: T) => void;
  }

  let { label, options, value = $bindable(), onchange }: Props = $props();
</script>

<label class="flex flex-col gap-1">
  <span class="text-xs font-medium text-base-content/70">{label}</span>
  <select
    class="select select-sm select-bordered min-w-40"
    bind:value
    onchange={() => onchange?.(value)}
  >
    {#each options as opt (opt.value)}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</label>
