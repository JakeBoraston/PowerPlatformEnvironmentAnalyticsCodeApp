<script lang="ts" module>
  export type KpiTone = 'neutral' | 'good' | 'warn' | 'bad';
</script>

<script lang="ts">
  /**
   * A KPI tile.
   *
   * Colour carries meaning here and nowhere else: `good` for a success count,
   * `warn` for something that needs a look, `bad` for a failure. Every other
   * figure is `neutral`. A toned tile whose value is zero drops back to
   * neutral, so a red tile always means there is something to act on.
   */
  let { label, value, subtitle = '', icon: Icon = null, tone = 'neutral' } = $props<{
    label: string;
    value: string | number;
    subtitle?: string;
    icon?: any;
    tone?: KpiTone;
  }>();

  let isZero = $derived(value === 0 || value === '0' || value === '0%');
  let effectiveTone = $derived<KpiTone>(isZero ? 'neutral' : tone);
</script>

<div class="pa-tile pa-tile--{effectiveTone} tile">
  <div class="head">
    <dt>{label}</dt>
    {#if Icon}
      <span class="icon" aria-hidden="true"><Icon size={16} /></span>
    {/if}
  </div>
  <dd>{value}</dd>
  {#if subtitle}
    <small>{subtitle}</small>
  {/if}
</div>

<style>
  .tile { display: flex; flex-direction: column; }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  dt { margin: 0; }

  .icon {
    display: grid;
    place-content: center;
    flex: none;
  }
</style>
