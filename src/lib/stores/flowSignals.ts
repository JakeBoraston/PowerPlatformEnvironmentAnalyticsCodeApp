import { derived } from 'svelte/store';
import { workflows } from './flowStore';
import { runsByFlow } from './flowSessionStore';
import { dashboardTimeRange } from './dashboardFilters';

/** Workflow statecode for a flow Power Automate has turned off itself. */
export const SUSPENDED_STATE = 2;

/** Fewer runs, or runs on fewer separate days, and there is no pattern to judge. */
const MIN_RUNS = 5;
const MIN_DISTINCT_DAYS = 5;

/**
 * How many runs a silence has to have missed before it is flagged. One missed
 * run is noise (a quiet morning, a bank holiday); three missed in a row is a
 * pattern breaking.
 */
const EXPECTED_RUNS_THRESHOLD = 3;

/** Silence shorter than this is never flagged, however frequent the flow. */
const MIN_SILENCE_MS = 2 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;
const HOURS_IN_WEEK = 168;

export interface QuietFlow {
  workflowid: string;
  name: string;
  lastRun: Date;
  /** Milliseconds since the last run started. */
  silentFor: number;
  /** Runs the flow would normally have made in that time, from its own history. */
  expectedRuns: number;
}

function hourOfWeek(time: number): number {
  const date = new Date(time);
  return date.getDay() * 24 + date.getHours();
}

/**
 * Active flows that have stopped running.
 *
 * When a trigger's connection expires, the flow does not fail: it simply stops
 * firing, so no run is recorded and nothing looks wrong. What does show is the
 * silence.
 *
 * Each flow's history gives it a rate for every hour of the week (Monday 09:00,
 * Monday 10:00 and so on). The runs it "should" have made since it last ran
 * are the sum of those rates across the silent hours. Nights and weekends carry
 * a rate near zero for business-hours flows, so they don't count against it.
 * A flow is flagged once that expectation passes the threshold with no run.
 */
export const quietFlows = derived(
  [workflows, runsByFlow, dashboardTimeRange],
  ([$workflows, $runsByFlow, $days]) => {
    const now = Date.now();
    const weeks = $days / 7;
    const quiet: QuietFlow[] = [];

    for (const flow of $workflows) {
      if (flow.statecode !== 1) continue;
      const starts = ($runsByFlow.get(flow.workflowid) ?? [])
        .map((run) => (run.starttime ? new Date(run.starttime).getTime() : NaN))
        .filter((t) => !Number.isNaN(t));
      if (starts.length < MIN_RUNS) continue;
      if (new Set(starts.map((t) => new Date(t).toDateString())).size < MIN_DISTINCT_DAYS) continue;

      const ratePerHour = new Array<number>(HOURS_IN_WEEK).fill(0);
      for (const t of starts) ratePerHour[hourOfWeek(t)] += 1 / weeks;

      const lastRun = Math.max(...starts);
      const silentFor = now - lastRun;
      if (silentFor < MIN_SILENCE_MS) continue;

      let expectedRuns = 0;
      for (let t = lastRun + HOUR_MS; t <= now; t += HOUR_MS) {
        expectedRuns += ratePerHour[hourOfWeek(t)];
      }

      if (expectedRuns >= EXPECTED_RUNS_THRESHOLD) {
        quiet.push({
          workflowid: flow.workflowid,
          name: flow.name ?? 'Unnamed flow',
          lastRun: new Date(lastRun),
          silentFor,
          expectedRuns,
        });
      }
    }

    return quiet.sort((a, b) => b.expectedRuns - a.expectedRuns);
  }
);

export const quietFlowIds = derived(quietFlows, ($quiet) => new Set($quiet.map((q) => q.workflowid)));

/** Flows Power Automate has suspended, with its stated reason where it gave one. */
export const suspendedFlows = derived(workflows, ($workflows) =>
  $workflows.filter((flow) => flow.statecode === SUSPENDED_STATE)
);
