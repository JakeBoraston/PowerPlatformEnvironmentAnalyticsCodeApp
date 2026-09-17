<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import TimeRangeSelect from '$lib/components/TimeRangeSelect.svelte';
  import { environmentId } from '$lib/stores/powerContext';
  import { themePreference, themeOptions } from '$lib/stores/themeStore';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader title="Settings" subtitle="Preferences for this session" />

  <section class="pa-card max-w-md flex flex-col gap-3" aria-labelledby="settings-appearance-heading">
    <h2 id="settings-appearance-heading" class="pa-h3 text-base font-semibold">Appearance</h2>
    <p class="text-sm text-base-content/70">
      Light or dark colours for this app. Your choice is remembered in this browser.
    </p>
    <FilterSelect
      label="Theme"
      options={themeOptions}
      value={$themePreference}
      onchange={(value) => themePreference.set(value)}
    />
  </section>

  <section class="pa-card max-w-md flex flex-col gap-3" aria-labelledby="settings-range-heading">
    <h2 id="settings-range-heading" class="pa-h3 text-base font-semibold">Flow run period</h2>
    <p class="text-sm text-base-content/70">
      How far back flow run figures reach on the dashboard, Flows and Failures. Dataverse keeps flow run history for 28 days by default, so that is the longest period offered.
    </p>
    <TimeRangeSelect label="Period" />
  </section>

  <section class="pa-card max-w-md flex flex-col gap-2" aria-labelledby="settings-env-heading">
    <h2 id="settings-env-heading" class="pa-h3 text-base font-semibold">Environment</h2>
    <dl class="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      <dt class="text-base-content/70">Environment ID</dt>
      <dd class="font-mono text-xs break-all self-center">{$environmentId || 'Not identified by the host'}</dd>
    </dl>
    {#if !$environmentId}
      <p class="text-xs text-base-content/70">
        Without it, the links out to Power Automate and Copilot Studio are unavailable. Open the app from Power Apps rather than directly.
      </p>
    {/if}
  </section>
</div>
