<script lang="ts">
  import Router, { location } from 'svelte-spa-router';
  import { fade } from 'svelte/transition';
  import Sidebar from '$lib/components/Layout/Sidebar.svelte';
  import { loadRouteData } from '$lib/stores/dataRegistry';
  import { themeMode } from '$lib/stores/themeStore';
  import Dashboard from './routes/Dashboard.svelte';
  import Flows from './routes/Flows.svelte';
  import FlowDetail from './routes/FlowDetail.svelte';
  import Failures from './routes/Failures.svelte';
  import Connections from './routes/Connections.svelte';
  import CanvasApps from './routes/CanvasApps.svelte';
  import ModelApps from './routes/ModelApps.svelte';
  import BotsPage from './routes/BotsPage.svelte';
  import BotDetail from './routes/BotDetail.svelte';
  import SolutionsPage from './routes/SolutionsPage.svelte';
  import SolutionHistory from './routes/SolutionHistory.svelte';
  import EnvironmentVariables from './routes/EnvironmentVariables.svelte';
  import SystemJobs from './routes/SystemJobs.svelte';
  import UsersPage from './routes/UsersPage.svelte';
  import Settings from './routes/Settings.svelte';
  import NotFound from './routes/NotFound.svelte';

  const routes = {
    '/': Dashboard,
    '/flows': Flows,
    '/flows/:id': FlowDetail,
    '/failures': Failures,
    '/connections': Connections,
    '/canvas-apps': CanvasApps,
    '/model-apps': ModelApps,
    '/agents': BotsPage,
    '/agents/:id': BotDetail,
    '/solutions': SolutionsPage,
    '/solution-history': SolutionHistory,
    '/environment-variables': EnvironmentVariables,
    '/system-jobs': SystemJobs,
    '/users': UsersPage,
    '/settings': Settings,
    '*': NotFound,
  };

  // Stores no longer fetch themselves on SDK init. Each route declares what it
  // needs in dataRegistry, and we load it here when the route becomes active —
  // usually a no-op, because hovering the nav link already started the fetch.
  $effect(() => {
    loadRouteData($location);
  });

  const routeTitles: Record<string, string> = {
    '/': 'Dashboard',
    '/flows': 'Cloud flows',
    '/failures': 'Failures',
    '/connections': 'Connections',
    '/canvas-apps': 'Canvas apps',
    '/model-apps': 'Model-driven apps',
    '/agents': 'Agents',
    '/solutions': 'Solutions',
    '/solution-history': 'Solution history',
    '/environment-variables': 'Environment variables',
    '/system-jobs': 'System jobs',
    '/users': 'Users',
    '/settings': 'Settings',
  };

  function titleFor(path: string): string {
    if (routeTitles[path]) return routeTitles[path];
    if (path.startsWith('/flows/')) return 'Flow';
    if (path.startsWith('/agents/')) return 'Agent';
    return 'Not found';
  }

  let mainEl: HTMLElement;
  let firstRoute = true;

  // <main> is the only scroller and outlives the pages inside it, so it
  // remembers where each page was left and otherwise opens a page at the top.
  const scrollByPath = new Map<string, number>();
  let currentPath = '';

  function rememberScroll() {
    if (mainEl && currentPath) scrollByPath.set(currentPath, mainEl.scrollTop);
  }

  // A hash route change is silent to a screen reader. Name the page in the tab
  // title, and after the first render move focus to the new content so the
  // reader starts there instead of at the top of the nav.
  $effect(() => {
    const path = $location;
    currentPath = path;
    document.title = `${titleFor(path)} · Environment Analytics`;
    const saved = scrollByPath.get(path) ?? 0;
    queueMicrotask(() => {
      if (!mainEl) return;
      mainEl.scrollTop = saved;
      if (firstRoute) {
        firstRoute = false;
        return;
      }
      mainEl.focus({ preventScroll: true });
    });
  });
</script>

<style>
  /* The shell never scrolls; only <main> does. */
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
  }

  /* 100% rather than 100vw/100vh: viewport units include a page scrollbar's
     width, which pushed the shell wider than the frame and added a sideways
     scroll. */
  :global(#app) {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* position: relative makes the scroller the containing block for the
     absolutely positioned screen-reader text (sr-only). Without it that text is
     placed against the page, stretches the document below the fold and gives
     the Power Apps frame a second scrollbar. */
  .app-content {
    flex: 1;
    min-width: 0;
    overflow: auto;
    position: relative;
    background-color: var(--page);
  }
  .app-content:focus {
    outline: none;
  }
</style>

<a class="pa-skip" href="#main" onclick={(e) => { e.preventDefault(); mainEl?.focus(); }}>Skip to content</a>

<div class="flex h-full w-full">
  <Sidebar />
  <main id="main" class="app-content" tabindex="-1" bind:this={mainEl} onscroll={rememberScroll}>
    <!-- Charts draw with literal colours, so a mode change remounts the page
         and every chart redraws in the new palette. -->
    {#key `${$location}|${$themeMode}`}
      <div in:fade={{ duration: 160 }} class="min-h-full">
        <Router {routes} />
      </div>
    {/key}
  </main>
</div>
