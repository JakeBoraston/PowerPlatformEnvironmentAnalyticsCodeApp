<script lang="ts">
  import { location } from "svelte-spa-router";
  import { prefetchRoute } from "$lib/stores/dataRegistry";
  import {
    LayoutDashboard,
    Workflow,
    TriangleAlert,
    Settings,
    AppWindow,
    LayoutGrid,
    Bot,
    Package,
    Users,
    Cable,
    History,
    Variable,
    Server,
    PanelLeftClose,
    PanelLeftOpen,
  } from "lucide-svelte";

  // Start collapsed on a narrow viewport (Power Apps mobile, a docked pane) so
  // the rail doesn't take most of the screen before the user has asked for it.
  // The Power Apps frame can report a zero width while it lays out, so only a
  // measured narrow width counts as narrow.
  let isOpen = $state(typeof window === 'undefined' || !(window.innerWidth > 0 && window.innerWidth < 768));
  let currentPath = $derived($location);

  /** Detail routes keep their section highlighted: /flows/abc lights up Flows. */
  function isActive(path: string): boolean {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(`${path}/`);
  }

  function handleLinkClick(event: MouseEvent) {
    const link = event.currentTarget as HTMLAnchorElement;
    setTimeout(() => link.blur(), 0);
  }

  /**
   * Start the route's fetches as soon as there's intent to navigate. By the time
   * the click lands the data is usually already in the store, so the page renders
   * populated instead of flashing a spinner.
   */
  function handleLinkIntent(path: string) {
    prefetchRoute(path);
  }

  interface NavItem {
    label: string;
    path: string;
    icon: any;
  }

  interface NavSection {
    heading: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      heading: "Overview",
      items: [{ label: "Dashboard", path: "/", icon: LayoutDashboard }],
    },
    {
      heading: "Power Automate",
      items: [
        { label: "Flows", path: "/flows", icon: Workflow },
        { label: "Failures", path: "/failures", icon: TriangleAlert },
      ],
    },
    {
      heading: "Apps",
      items: [
        { label: "Canvas Apps", path: "/canvas-apps", icon: AppWindow },
        { label: "Model Apps", path: "/model-apps", icon: LayoutGrid },
      ],
    },
    {
      heading: "Copilot Studio",
      items: [{ label: "Agents", path: "/agents", icon: Bot }],
    },
    {
      heading: "Platform",
      items: [
        { label: "Solutions", path: "/solutions", icon: Package },
        { label: "Solution History", path: "/solution-history", icon: History },
        { label: "Connections", path: "/connections", icon: Cable },
        { label: "Environment Variables", path: "/environment-variables", icon: Variable },
        { label: "System Jobs", path: "/system-jobs", icon: Server },
        { label: "Users", path: "/users", icon: Users },
      ],
    },
  ];
</script>

<aside class="rail" class:open={isOpen} class:closed={!isOpen}>
  <nav aria-label="Main">
    <header>
      <!-- Removed from the DOM rather than hidden with CSS: the rail animates its
           width, so a `display: none` rule races the transition and the brand can
           briefly share the header with the toggle and overlap it. -->
      {#if isOpen}
        <div class="brand">
          <span class="mark" aria-hidden="true">PA</span>
          <span class="brand-text">
            <b>Platform</b>
            <i>Analytics</i>
          </span>
        </div>
      {/if}
      <button
        type="button"
        class="collapse"
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        aria-expanded={isOpen}
        onclick={() => (isOpen = !isOpen)}
      >
        {#if isOpen}
          <PanelLeftClose size={17} aria-hidden="true" />
        {:else}
          <PanelLeftOpen size={17} aria-hidden="true" />
        {/if}
      </button>
    </header>

    <div class="scroll">
      {#each navSections as section, i (section.heading)}
        <div class="group">
          <p class="group-label" id="nav-group-{i}">{section.heading}</p>
          <ul aria-labelledby="nav-group-{i}">
            {#each section.items as item (item.path)}
              <li>
                <a
                  class="link"
                  class:active={isActive(item.path)}
                  aria-current={isActive(item.path) ? "page" : undefined}
                  href="#{item.path}"
                  data-tip={item.label}
                  onclick={handleLinkClick}
                  onmouseenter={() => handleLinkIntent(item.path)}
                  onfocus={() => handleLinkIntent(item.path)}
                >
                  <span class="icon" aria-hidden="true"><item.icon size={17} /></span>
                  <span class="text">{item.label}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>

    <footer>
      <a
        class="link"
        class:active={isActive("/settings")}
        aria-current={isActive("/settings") ? "page" : undefined}
        href="#/settings"
        data-tip="Settings"
        onclick={handleLinkClick}
        onmouseenter={() => handleLinkIntent("/settings")}
        onfocus={() => handleLinkIntent("/settings")}
      >
        <span class="icon" aria-hidden="true"><Settings size={17} /></span>
        <span class="text">Settings</span>
      </a>
    </footer>
  </nav>
</aside>

<style>
  .rail {
    --w-open: 15.5rem;
    --w-closed: 3.5rem;
    flex: 0 0 var(--w-closed);
    height: 100%;
    background: var(--rail);
    transition: flex-basis 220ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: flex-basis;
    position: relative;
    z-index: var(--z-sticky);
    /* A flex item defaults to `min-width: auto`, which is its min-content width.
       The longest nav label is `white-space: nowrap`, so the rail refused to
       shrink below ~193px however small flex-basis was. This line is what
       actually makes the collapse work. Content clipping is `nav`'s job — the
       rail must not clip, or the collapsed tooltips get cut off. */
    min-width: 0;
  }

  .rail.open { flex-basis: var(--w-open); }
  .rail.closed { flex-basis: var(--w-closed); }

  nav {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0.75rem 0.5rem 0.625rem;
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.125rem 0.5rem;
    min-width: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    flex: 1 1 auto;
    /* The mark and the label must never push the toggle out of the header. */
    overflow: hidden;
  }

  .mark {
    width: 1.875rem;
    height: 1.875rem;
    border-radius: 50%;
    background: var(--on-rail);
    color: var(--rail);
    display: grid;
    place-content: center;
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    flex: none;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
    min-width: 0;
    white-space: nowrap;
  }
  .brand-text b { color: var(--on-rail); font-size: 0.8125rem; font-weight: 650; }
  .brand-text i { color: var(--on-rail-dim); font-size: 0.75rem; font-style: normal; }

  .collapse {
    background: none;
    border: none;
    color: var(--on-rail-dim);
    padding: 0.375rem;
    min-width: 2rem;
    min-height: 2rem;
    border-radius: var(--r-ctl);
    cursor: pointer;
    display: grid;
    place-content: center;
    flex: none;
  }
  .collapse:hover { background: rgba(255, 255, 255, 0.09); color: var(--on-rail); }
  .collapse:focus-visible { outline: 2px solid var(--on-rail); outline-offset: -2px; }

  .scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    margin: 0 -0.125rem;
    padding: 0 0.125rem;
  }
  .scroll::-webkit-scrollbar { width: 0.25rem; }
  .scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 999px; }

  .group + .group { margin-top: 0.5rem; }

  .group-label {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
    color: var(--on-rail-dim);
    margin: 0;
    padding: 0.75rem 0.625rem 0.3125rem;
    white-space: nowrap;
  }

  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.0625rem; }

  .link {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-height: 2.25rem;
    padding: 0.5rem 0.5rem;
    border-radius: var(--r-ctl);
    color: var(--on-rail-dim);
    text-decoration: none;
    font-size: 0.8125rem;
    transition: background 140ms ease-out, color 140ms ease-out;
    position: relative;
  }

  .icon { display: grid; place-content: center; flex: none; width: 1.5rem; }

  .text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
  }

  .link:hover { background: rgba(255, 255, 255, 0.09); color: var(--on-rail); }

  .link.active {
    background: var(--primary);
    color: var(--on-primary);
    font-weight: 600;
  }
  .link.active:hover { background: var(--primary); color: var(--on-primary); }

  .link:focus-visible {
    outline: 2px solid var(--on-rail);
    outline-offset: -2px;
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.625rem;
    margin-top: 0.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }


  /* Collapsed: icons only, labels tucked away, tooltips take over.
     The brand is removed from flow rather than faded, because at 3.5rem it would
     otherwise push the collapse button out of the rail, where `overflow: hidden`
     clips it — leaving no way to expand again. */
  /* Brand is removed from the DOM when collapsed, so the toggle is the only
     thing left in the header and centres in the icon column. */
  .rail.closed header { justify-content: center; padding-inline: 0; }

  .rail.closed .group-label,
  .rail.closed .text {
    opacity: 0;
    pointer-events: none;
  }

  .rail.closed .group-label { padding-block: 0.375rem 0; height: 0; }

  .rail.open :where(.brand-text, .group-label, .text) {
    transition: opacity 180ms ease-out 90ms;
  }

  .rail.closed .link[data-tip]:where(:hover, :focus-visible)::after {
    content: attr(data-tip);
    position: fixed;
    left: 3.75rem;
    z-index: var(--z-tooltip);
    background: var(--rail);
    color: var(--on-rail);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: var(--r-ctl);
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  }

  @media (prefers-reduced-motion: reduce) {
    .rail,
    .link,
    .rail.open :where(.brand-text, .group-label, .text) {
      transition: none;
    }
  }
</style>
