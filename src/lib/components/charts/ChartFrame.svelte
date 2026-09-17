<script lang="ts" module>
  export interface ChartColumn {
    key: string;
    label: string;
  }

  export type ChartRow = Record<string, string | number>;

  export interface LegendItem {
    key: string;
    label?: string;
    color: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChartNoAxesColumn } from 'lucide-svelte';

  /**
   * The card every chart sits in. It owns the parts a chart library can't do
   * for us accessibly:
   *
   * - the plot is exposed as one image, named by `title` and described by
   *   `summary`, rather than a few hundred unlabelled SVG paths;
   * - `columns` / `rows` render the same numbers as a table behind a
   *   disclosure, so the data is readable without seeing the chart;
   * - an empty state when there is nothing to plot;
   * - an optional legend that wraps inside the card.
   *
   * Same shape as Iris's ChartFrame, restyled for this app's tokens, so the two
   * apps' charts read alike.
   */
  interface Props {
    title: string;
    /** The chart's finding in one sentence, for anyone who cannot see it. */
    summary: string;
    /** Optional line under the title, visible to everyone. */
    caption?: string;
    /** Table alternative. The first column is the row header. */
    columns: ChartColumn[];
    rows: ChartRow[];
    emptyMessage?: string;
    legend?: LegendItem[];
    /** Plot height in pixels. */
    height?: number;
    /** Extra content beside the plot (e.g. a stat list). */
    aside?: Snippet;
    children: Snippet;
  }

  let {
    title,
    summary,
    caption,
    columns,
    rows,
    emptyMessage = 'Nothing to show for this period.',
    legend,
    height = 256,
    aside,
    children,
  }: Props = $props();

  const uid = $props.id();
  const titleId = `${uid}-title`;
  const summaryId = `${uid}-summary`;

  let rowHeaderKey = $derived(columns[0]?.key ?? '');
</script>

<section class="pa-card chart-frame" aria-labelledby={titleId}>
  <h3 id={titleId} class="pa-h3 text-sm font-semibold text-center">{title}</h3>
  {#if caption}
    <p class="text-xs text-base-content/70 text-center mt-0.5">{caption}</p>
  {/if}

  {#if rows.length > 0}
    <div class="flex flex-col lg:flex-row gap-4 mt-3">
      <div
        class="plot min-w-0 flex-1"
        style="height: {height}px"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={summaryId}
      >
        {@render children()}
      </div>
      {#if aside}
        <div class="lg:w-2/5 min-w-0">{@render aside()}</div>
      {/if}
    </div>
    <p id={summaryId} class="sr-only">{summary}</p>

    {#if legend && legend.length > 0}
      <!-- A sighted convenience: the table below carries the same series. -->
      <ul class="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 list-none p-0" aria-hidden="true">
        {#each legend as item (item.key)}
          <li class="flex items-center gap-1.5 text-xs text-base-content/70">
            <span class="swatch" style="background: {item.color}"></span>
            {item.label ?? item.key}
          </li>
        {/each}
      </ul>
    {/if}

    <details class="mt-3 text-sm">
      <summary class="cursor-pointer text-xs text-base-content/70 w-fit">Show data table</summary>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="mt-2 max-h-64 overflow-auto pa-scroll" tabindex="0" role="region" aria-label="{title} data">
        <table class="pa-table">
          <caption class="sr-only">{title}. {summary}</caption>
          <thead>
            <tr>
              {#each columns as column, index (column.key)}
                <th scope="col" class:num={index > 0}>{column.label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each rows as row, rowIndex (`${row[rowHeaderKey]}-${rowIndex}`)}
              <tr>
                {#each columns as column, index (column.key)}
                  {#if index === 0}
                    <th scope="row" class="font-normal text-left">{row[column.key]}</th>
                  {:else}
                    <td class="num">{row[column.key]}</td>
                  {/if}
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {:else}
    <div class="empty" style="height: {height}px">
      <ChartNoAxesColumn size={20} aria-hidden="true" />
      <p class="text-sm">{emptyMessage}</p>
    </div>
  {/if}
</section>

<style>
  .chart-frame {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .swatch {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 2px;
    flex: none;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--ink-2);
  }
</style>
