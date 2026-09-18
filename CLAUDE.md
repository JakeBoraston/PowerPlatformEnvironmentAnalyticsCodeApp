# Platform Analytics: Power Platform Code App

## Overview

Svelte 5 Code App that provides an analytical dashboard for a Power Platform
environment. Branded **"Environment Analytics"** in the UI (sidebar + dashboard
heading) — the folder name `FlowAnalytics` predates the broader scope. It started
as a Power Automate flow-run dashboard and now also covers Canvas Apps, Model
(model-driven) Apps, Copilot Studio agents, Solutions, and environment Users.

Reads Dataverse standard/elastic tables via the auto-generated services in
`src/generated/services/`. Read-only — it visualises, it doesn't write back.

## Tech Stack

- **Svelte 5** with runes API (`$state`, `$derived`, `$derived.by`, `$effect`)
- **Tailwind CSS 4** + **DaisyUI 5** (stock light theme; nothing tenant-specific, see README.md)
- **LayerChart 2** (`^2.0.1`, locked at 2.0.1) for every
  chart: area, line, bar, donut, gauge (`Arc`), radar (radial `LineChart`),
  treemap (`layerchart/hierarchy`), scatter, and the day/hour heatmap (`Cell`).
  The website documents a newer release; trust the installed types and the
  `*.svelte.test.js` files under `node_modules/layerchart/dist`
- **D3** (`d3-force`/`d3-selection`/`d3-zoom`/`d3-drag`) for `ClusterGraph`, the
  force layout behind the connection and ownership graphs, which needs drag, zoom
  and click-to-isolate. `d3-shape`, `d3-hierarchy` and `d3-scale` are imported by
  the LayerChart charts directly
- **Lucide Svelte** — icons
- **svelte-spa-router** — client-side hash routing
- **@microsoft/power-apps** — Power Platform Code Apps SDK

State is **Svelte stores** (`writable`/`derived` from `svelte/store`) in
`src/lib/stores/`, NOT class singletons.
Stores load on demand through `dataRegistry` (see Lazy data loading below).

## Data Sources (Dataverse)

Each store owns one table via its generated service:

| Store | Service / Table | Notes |
|---|---|---|
| `flowStore` | `WorkflowsService` (`workflow`) | Cloud flows — filter `category eq 5` |
| `flowSessionStore` | `FlowrunsService` (`flowrun`, **elastic**) | Run records. Paginates via `skipToken` (cap 20 pages × 5000). `status` is a **string** ('Succeeded' / 'Failed' / 'Cancelled' / 'Running' / 'Waiting'), `duration` is **milliseconds** (about 1,000 times `endtime - starttime`); always read it through `parseDuration`, which returns seconds. Filtered by `starttime ge {cutoff}` from the dashboard time range. |
| `canvasAppStore` | `CanvasappsService` (`canvasapp`) | Owners use AAD object IDs (see `resolveOwnerName`) |
| `modelAppStore` | `AppmodulesService` (`appmodule`) | Model-driven apps |
| `solutionStore` | `SolutionsService` (`solution`) | |
| `botStore` | `BotsService` (`bot`) | Copilot Studio agents. `statecode === 0` = **Active**, else Draft |
| `botComponentStore` | `BotcomponentsService` (`botcomponent`) | Topics/knowledge/etc. Grouped by `_parentbotid_value`. Type labels in `getComponentTypeLabel` (0/9 = Topic, 16 = Knowledge Source) |
| `conversationStore` | `ConversationtranscriptsService` (`conversationtranscript`) | Last 28 days only. Grouped by `_bot_conversationtranscriptid_value` (must be in `$select` to resolve). Metadata only — no transcript content fetched |
| `userStore` | `SystemusersService` (`systemuser`) | `userNameMap` indexes by both `systemuserid` and `azureactivedirectoryobjectid` |
| `connectionReferenceStore` | `ConnectionreferencesService` (`connectionreference`) | Connector bindings. `connectorid` is a provider path — strip to the last segment. Also derives `connectorGraph` and `orphanedConnectionReferences` by parsing `workflow.clientdata` |
| `solutionHistoryStore` | `Msdyn_solutionhistoriesService` (`msdyn_solutionhistory`, **virtual**) | Import/export/upgrade history. Virtual table: 1,000 records per page, no change tracking, so this reads newest-first with an explicit `top` |
| `environmentVariableStore` | `Environmentvariabledefinitions` + `Environmentvariablevalues` | Fetched as a pair. `envVarRows` joins them; `unresolved` (no value **and** no default) is the row state that matters on a deployment |
| `systemJobStore` | `AsyncoperationsService` (`asyncoperation`) | Async platform jobs. `statuscode` 30/31/32 = Succeeded/Failed/Canceled; anything below 30 is still in flight. Reads the most recent 2,000 |

`FlowsessionsService` is generated but unused — flow runs come from the `flowrun`
elastic table, not `flowsession`. Note that `flowsession` is also **empty in DEV**
(no desktop flows exist), so there is nothing to show even if it were wired up.

### How flows link to connectors
There is no relationship between `workflow` and `connectionreference`. The binding
lives in the flow's `clientdata` JSON at `properties.connectionReferences`, where
each entry gives `api.name` (e.g. `shared_sharepointonline`) and
`connection.connectionReferenceLogicalName` (matching
`connectionreference.connectionreferencelogicalname`).

`clientdata` is large but **is** returned when no `$select` is supplied, which is
how `flowStore` queries — so the graph costs no extra request. If you ever add a
`$select` to `fetchWorkflows`, `clientdata` must stay in it or the connector graph
silently empties.

> Note: `statecode` semantics differ by table — workflows use `1` = Active, bots
> use `0` = Active. Check the store before reusing a badge condition.

## Setup

This app uses the **npm CLI** (`@microsoft/power-apps-cli`), not `pac code`.
Microsoft has deprecated the `pac code` commands in favour of it.

```bash
npm install
npm run dev         # just `vite` — the powerApps() Vite plugin proxies Dataverse
npm run build
npm run check       # svelte-check
npx power-apps push # deploy to the environment
```

Command mapping from the old tooling:

| Old | New |
|---|---|
| `pac code run` | `npm run dev` (the `powerApps()` Vite plugin does the proxying) |
| `pac code push` | `npx power-apps push` |
| `pac code add-data-source -a dataverse -t <table>` | `npx power-apps add-data-source -a dataverse -t <table>` |
| `pac code delete-data-source` | `npx power-apps delete-data-source` |
| — | `npx power-apps refresh-data-source` — regenerates without clobbering the others |
| — | `npx power-apps list-tables` / `list-connections` / `list-connectors` / `list-flows` |
| — | `npx power-apps add-flow` — invoke a solution cloud flow from the app |
| `pac auth create` | `npx power-apps login` (separate credential cache from pac) |

`refresh-data-source` is the one to reach for after any data-source change: the old
`pac code add-data-source` regenerated `src/generated` with **only** the touched
source and had to be repaired from git.

The SDK has no `initialize()` from client library v1 onward. `getContext()` resolves
once the host is ready and is the readiness signal — see `stores/powerContext.ts`.

A fresh checkout has **no `node_modules`** and **no `.power/schemas/appschemas/dataSourcesInfo`**.
Until both exist, `npm run check` / `vite build` report errors in every
`generated/services/*.ts` ("Cannot find module … dataSourcesInfo"). These are
environmental, not regressions — judge new work by whether it *adds* errors.
The baseline is **0 errors, 0 warnings**; keep it there.

## Routes / Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | `Dashboard` | Platform overview KPIs + environment health checks, then flow KPIs and charts (runs over time, success rate, **ActivityHeatmap**, status, weekly trend, optimisation scatter, duration, failures), then ownership graph + platform treemap |
| `/flows` | `Flows` | All cloud flows with per-flow run stats (`FlowsTable`) |
| `/flows/:id` | `FlowDetail` | One flow — KPIs, run-trend chart, **per-flow ActivityHeatmap**, "Open in Power Automate" link, tabbed run history with per-run links |
| `/failures` | `Failures` | Failed + cancelled runs with error-detail dialog (`FailuresTable`) |
| `/connections` | `Connections` | Connection reference inventory, connector usage bars, orphan warning, and the **D3 flow-to-connector graph** |
| `/canvas-apps` | `CanvasApps` | Canvas app inventory |
| `/model-apps` | `ModelApps` | Model-driven app inventory |
| `/agents` | `BotsPage` | Copilot Studio agents — KPIs, component-type pie, sortable table; rows link to detail, plus "Open in Copilot Studio" per row |
| `/agents/:id` | `BotDetail` | One agent — KPIs (topics/knowledge/components/conversations/status), **usage ActivityHeatmap**, "Open in Copilot Studio" link, component breakdown, recent conversations |
| `/solutions` | `SolutionsPage` | Solution inventory |
| `/solution-history` | `SolutionHistory` | Import/export/upgrade/publish history, busiest solutions, failed-only filter |
| `/environment-variables` | `EnvironmentVariables` | Definitions joined to values, with unresolved variables called out |
| `/system-jobs` | `SystemJobs` | Async platform jobs, breakdown by operation type, failed-by-default filter, message dialog |
| `/users` | `UsersPage` | Environment users |
| `/settings` | `Settings` | Time range config + data-source setup notes |

Sidebar nav (`Layout/Sidebar.svelte`) groups these under Overview / Power Automate /
Apps / Copilot Studio / Platform / Settings. Connections sits under Platform:
connection references serve apps and agents as well as flows.

## Key Patterns

### Lazy data loading (do not reintroduce eager fetches)
Stores used to self-fetch the moment `powerContextReady` flipped true, so opening
the app fired every query in parallel no matter which route you landed on. They
now expose an `ensureXLoaded()` built by `createLazyLoader` (`stores/lazyLoad.ts`),
which waits for the SDK, runs the fetch **at most once**, and de-duplicates
concurrent callers. A failed load clears the cache so the next call retries.

Wiring:
- `stores/dataRegistry.ts` maps each route to the loaders it needs.
- `App.svelte` calls `loadRouteData($location)` in an `$effect` when the route changes.
- `Sidebar.svelte` calls `prefetchRoute(path)` on `mouseenter`/`focus`, so the fetch
  usually starts before the click lands.

**When adding a store, add it to `dataRegistry` — do not add a `powerContextReady`
subscription.** A store missing from the registry will simply never load.
Route keys support `:params` (`/flows/:id`).

### Reading tables: always page
The SDK's `getAll` returns **one page of 500 rows** unless told otherwise
(`odata.maxpagesize=500` in `dataverseDataOperationExecutor`), and `top` does not
page for you, so `top: 2000` silently returns 500. Read through
`readAll` (whole table) or `readPages` (most recent N, with a `truncated` flag the
page must disclose) from `utils/readPages.ts`. Never call `getAll` and use
`result.data` as the full set.

### Deep links to the maker portals
`src/lib/stores/powerContext.ts` builds environment-scoped URLs (env ID resolved
from the SDK `getContext()`):
- `getFlowRunUrl(workflowId, runName)` — a specific run. Uses the run **`name`**
  (e.g. `08584…CU06`), NOT the `flowrunid` GUID.
- `getFlowUrl(workflowId)` — the flow's details page.
- `getAgentUrl(botId)` — `copilotstudio.microsoft.com/environments/{env}/bots/{botid}`
  (format verified against Microsoft Learn).

All return `'#'` when the env ID or ID is missing — callers should disable the link
(`class:btn-disabled={url === '#'}`).

### Reusable ActivityHeatmap
`charts/ActivityHeatmap.svelte` renders a 7×24 day/hour heatmap from any records
with a `starttime` ISO field. Props:
- `runs?` — omit for the env-wide `flowRuns` store (dashboard); pass a scoped array
  for one flow (`runsByFlow.get(id)`) or one agent's conversations mapped to
  `{ starttime: conv.conversationstarttime }`.
- `title?` — chart heading.

### Portability and accessibility conventions
The app must deploy to any tenant unchanged (README.md covers the steps), and
meet WCAG 2.2 AA.
- No tenant, environment or publisher values in `src/`. `.power/schemas` is
  committed; it holds only generated table schemas.
- Store failures go through `describeLoadError` (`utils/loadError.ts`), which
  turns a 403 or a missing table into a sentence a maker can act on. Pass the
  store's error store to `createLazyLoader(fetch, error)` so a failed load
  retries on the next visit.
- Pages open with `ui/PageHeader` (the page `h1`, back link, named refresh
  button). Filters use `ui/SearchField` and `ui/FilterSelect` (visible labels).
  Sortable columns use `ui/SortHeader`. Links out to the maker portals use
  `ui/ExternalLinkButton`, which disables itself when the environment ID is
  unknown instead of rendering a live `#`.
- Rows are never clickable on their own: put a link on the name cell.
- Table scroll wrappers carry `pa-scroll pa-table-region`, `tabindex="0"`,
  `role="region"` and an `aria-label`.
- Charts go through `ChartFrame` with a real `summary` and data table (see Charts).
- Grey text is `text-base-content/70` or darker; `/60` and below fail contrast.
  Text on a state wash uses `--ok-ink` / `--warn-ink` / `--bad-ink`, never the
  fill colour.
- Dates format with the viewer's locale (`toLocaleDateString(undefined, ...)`).
- Colour means status and nothing else. KPI tiles take `tone` (`good` for
  successes, `warn` for needs-a-look, `bad` for failures, otherwise neutral);
  pills use `pa-pill--ok/warn/bad/idle` on the same rule. Categories such as
  managed/unmanaged or system/custom are always `idle`.
- Light and dark mode come from `stores/themeStore.ts` (Settings > Appearance).
  Chart colours live in `utils/chartTheme.ts` per mode; never hard-code a hex in
  a chart, use `chrome.*` / `theme.*` so it follows the mode.

### `{@const}` placement
`{@const}` must be an **immediate child** of a block (`{#each}`, `{#if}`, etc.) — not
nested inside a `<td>`/`<div>`. For per-row URLs, declare the const right after the
`{#each … as row}` line, alongside any existing row consts.

### Charts (LayerChart)
Every chart sits in `charts/ChartFrame.svelte`, which exposes the plot as one
image named by `title` and described by `summary` (one sentence stating the
finding), renders `columns`/`rows` as a data table behind "Show data table", shows
`emptyMessage` when there is nothing to plot, and draws a wrapping `legend`. Use
that legend rather than LayerChart's built-in one. Part-of-a-whole charts use
`charts/DonutChart.svelte`. Data is plain `$derived`; there is no chart instance
to create, resize or dispose.

LayerChart 2.0.1 has no dual-axis chart, so the weekly trend is a stacked bar with
the rates in its summary and table.

The Power Apps webview paints LayerChart's hover highlight as a solid block,
because it mixes toward `transparent` in oklab; `app.css` overrides
`.lc-highlight-area` / `.lc-highlight-bar` with explicit alpha fills.

### Scrolling
`<main>` in `App.svelte` is the only vertical scroller. Page containers must not
set `overflow-y` or `h-full`, or the page gets a second scrollbar. `<main>` is
`position: relative` so `sr-only` text is placed inside it rather than against the
document, and it remembers each route's scroll position.

### Transitions
Use `in:fade` (not `transition:fade`) for page transitions to avoid layout shifts.
Pages are re-keyed on `$location` in `App.svelte`.

### Derived store dependencies
Don't depend on loading flags inside derived stores — read loading stores directly
in components. Fetch functions own their own loading state.

## Directory Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── Layout/Sidebar.svelte
│   │   ├── charts/                     # LayerChart components
│   │   │   ├── ChartFrame.svelte · DonutChart.svelte  # shared frame and donut
│   │   │   ├── ActivityHeatmap.svelte          # reusable 7×24 day/hour heatmap (flows + agents)
│   │   │   ├── RunsOverTimeChart.svelte · RunsByStatusChart.svelte
│   │   │   ├── SuccessRateChart.svelte · DurationChart.svelte
│   │   │   ├── FailuresByFlowChart.svelte · WeeklyTrendChart.svelte
│   │   │   ├── FlowRunTrendChart.svelte         # per-flow run trend (takes `runs` prop)
│   │   │   ├── OptimisationScatter.svelte
│   │   │   ├── EnvironmentHealthRadar.svelte · PlatformTreemap.svelte
│   │   │   ├── ClusterGraph.svelte (D3) · ConnectionGraph.svelte · OwnershipGraph.svelte
│   │   ├── ui/  (PageHeader, SearchField, FilterSelect, SortHeader, LoadError,
│   │   │         ExternalLinkButton, Badge, Spinner)
│   │   ├── KpiCard.svelte · TimeRangeSelect.svelte · AboutPanel.svelte
│   │   └── FlowsTable.svelte · FailuresTable.svelte
│   ├── PowerProvider.svelte                     # SDK init gate
│   ├── stores/                         # one store per table (see Data Sources) +
│   │   ├── powerContext.ts             #   SDK init, environmentId, deep-link helpers
│   │   ├── dashboardFilters.ts         #   time range, selected flow
│   │   ├── themeStore.ts               #   light / dark / system
│   │   └── lazyLoad.ts · dataRegistry.ts
│   ├── types/  (workflow.ts, flowSession.ts)
│   └── utils/  (chartTheme.ts, loadError.ts, dateUtils.ts, dataverse.ts, color.ts)
├── routes/   (Dashboard, Flows, FlowDetail, Failures, CanvasApps, ModelApps,
│              BotsPage, BotDetail, SolutionsPage, UsersPage, Settings)
├── generated/   (models + services — auto-generated, never hand-edit)
├── App.svelte · AppWrapper.svelte · main.ts
```

`@models/*` and `@services/*` aliases resolve to `src/generated/`. Never hand-edit
`generated/`; run `npx power-apps refresh-data-source` to regenerate.
