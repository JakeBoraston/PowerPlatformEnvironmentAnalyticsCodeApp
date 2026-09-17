<script lang="ts">
  import { CircleAlert, CircleCheck, Info, TriangleAlert, ChevronRight } from 'lucide-svelte';
  import {
    healthFindings,
    healthPassedCount,
    healthUnavailableCount,
    type CheckSeverity,
  } from '$lib/stores/healthChecks';

  /**
   * Environment health as a ranked list of things to do, rather than a score.
   * Each finding counts real records and links to the page that lists them.
   */
  const icons: Record<CheckSeverity, typeof CircleAlert> = {
    critical: CircleAlert,
    attention: TriangleAlert,
    housekeeping: Info,
  };

  const pillClass: Record<CheckSeverity, string> = {
    critical: 'pa-pill--bad',
    attention: 'pa-pill--warn',
    housekeeping: 'pa-pill--idle',
  };

  const severityLabel: Record<CheckSeverity, string> = {
    critical: 'Breaking now',
    attention: 'Risk',
    housekeeping: 'Housekeeping',
  };

  let findings = $derived($healthFindings);
  let breaking = $derived(findings.filter((f) => f.severity === 'critical').length);
</script>

<section class="pa-card flex flex-col gap-2" aria-labelledby="health-heading">
  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <h2 id="health-heading" class="pa-h3 text-sm font-bold uppercase tracking-wider">
      Environment health
    </h2>
    <p class="text-xs text-base-content/70">
      {$healthPassedCount + findings.length} checks
      {#if $healthUnavailableCount > 0}
        · {$healthUnavailableCount} could not run
      {/if}
    </p>
  </div>

  {#if findings.length === 0}
    <p class="flex items-center gap-2 text-sm">
      <CircleCheck size={18} class="text-success" aria-hidden="true" />
      Nothing to action. All {$healthPassedCount} checks passed.
    </p>
  {:else}
    <p class="text-sm">
      <span class="font-semibold">{findings.length} {findings.length === 1 ? 'thing' : 'things'} to look at</span>{#if breaking > 0}, {breaking} of {breaking === 1 ? 'which is' : 'which are'} breaking something now{/if}.
    </p>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="findings pa-scroll" tabindex="0" role="region" aria-label="Environment health findings">
      <ul class="flex flex-col gap-1 list-none p-0 m-0">
        {#each findings as finding (finding.id)}
          {@const Icon = icons[finding.severity]}
          <li>
            <a href="#{finding.href}" class="finding">
              <Icon size={14} class="shrink-0 mt-0.5" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block text-[0.8125rem] font-medium leading-tight">{finding.title}</span>
                <span class="block text-xs text-base-content/70 leading-tight">{finding.action}</span>
              </span>
              <span class="pa-pill {pillClass[finding.severity]} shrink-0">{severityLabel[finding.severity]}</span>
              <ChevronRight size={14} class="shrink-0 text-base-content/70" aria-hidden="true" />
            </a>
          </li>
        {/each}
      </ul>
    </div>

    {#if $healthPassedCount > 0}
      <p class="flex items-center gap-2 text-xs text-base-content/70">
        <CircleCheck size={14} class="text-success" aria-hidden="true" />
        {$healthPassedCount} other {$healthPassedCount === 1 ? 'check' : 'checks'} passed.
      </p>
    {/if}
  {/if}
</section>

<style>
  /* Its own scroll: the list is a summary, not the page's main content. */
  .findings {
    max-height: 15rem;
    overflow-y: auto;
  }

  .finding {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--r-ctl);
    border: 1px solid var(--line);
    color: var(--ink);
    text-decoration: none;
  }

  .finding:hover {
    background: var(--sunken);
  }
</style>
