<script lang="ts">
  import { ChevronDown, Info } from 'lucide-svelte';

  const STORAGE_KEY = 'platform-analytics:about-open';

  // Open until the viewer closes it; after that it stays closed in this browser.
  function readOpen(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  const initiallyOpen = readOpen();

  function remember(event: Event) {
    const open = (event.currentTarget as HTMLDetailsElement).open;
    try {
      localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // Not persisted; the panel still toggles.
    }
  }
</script>

<details class="pa-card about" open={initiallyOpen} ontoggle={remember}>
  <summary class="flex items-center gap-3 cursor-pointer list-none">
    <Info size={18} class="text-primary shrink-0" aria-hidden="true" />
    <h2 class="pa-h3 text-sm font-semibold flex-1">How this app works</h2>
    <ChevronDown size={16} class="chevron shrink-0 text-base-content/70" aria-hidden="true" />
  </summary>
  <div class="flex flex-col gap-2 mt-2 pl-[30px]">
    <p class="text-sm leading-relaxed">
      Platform Analytics reads the system tables Dataverse already keeps for every environment:
      cloud flows and their run history, canvas and model-driven apps, solutions and their import
      history, Copilot Studio agents, connection references, environment variables, system jobs and
      users. Nothing is installed alongside it and nothing is written back. Every figure is
      calculated in your browser from what those tables hold for this environment, so it works the
      same way in any environment it is deployed to.
    </p>
    <p class="text-sm leading-relaxed">
      <span class="font-semibold">Recommended security role:</span>
      <span class="font-semibold">System Administrator</span>, the only built-in role Microsoft documents as
      reading all of these tables across the environment. With a narrower role you will see only the records
      your role can read, and some sections may say they could not load. Agent conversation figures also need
      the <span class="font-semibold">Bot Transcript Viewer</span> role, which only an admin can assign. To
      avoid granting full admin rights, an admin can copy Basic User and add organisation-level Read on the
      tables above; test that role in a non-production environment first.
    </p>
  </div>
</details>

<style>
  .about summary::-webkit-details-marker { display: none; }
  .about :global(.chevron) { transition: transform 160ms ease-out; }
  .about[open] :global(.chevron) { transform: rotate(180deg); }

  @media (prefers-reduced-motion: reduce) {
    .about :global(.chevron) { transition: none; }
  }
</style>
