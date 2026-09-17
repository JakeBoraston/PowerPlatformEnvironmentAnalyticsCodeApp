<script lang="ts">
  import { onMount } from "svelte";
  import { powerContextReady, initPowerApps } from "./stores/powerContext";
  let {children} = $props();
  let contextReady = $derived($powerContextReady);

  onMount(async () => {
    try {
      initPowerApps();
    } catch (err) {
      console.error("SDK initialisation failed:", err);
    }
  });
</script>

{#if contextReady}
  {@render children()}
{:else}
  <div class="flex items-center justify-center h-full w-full bg-base-100" role="status">
    <div class="flex flex-col items-center gap-4">
      <div class="loading loading-spinner loading-lg text-primary" aria-hidden="true"></div>
      <p class="text-base-content/70 text-sm">Connecting to Power Platform...</p>
    </div>
  </div>
{/if}
