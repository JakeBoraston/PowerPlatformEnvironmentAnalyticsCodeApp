/**
 * Dataverse `flowsession` table — stores individual flow run records.
 * Each row is one execution of a cloud flow.
 *
 * Once `pac code add-data-source -a dataverse -t flowsession` is run,
 * the auto-generated model will supersede this manual type.
 */
export interface FlowSession {
  flowsessionid: string;
  name?: string;
  regardingobjectid?: string;  // Lookup to workflow (parent flow)
  parentworkflowid?: string;   // String ID of parent workflow
  startedon: string;           // ISO datetime
  completedon?: string;        // ISO datetime
  runduration?: number;        // Total duration (ms)
  runexecutionduration?: number;
  runwaitduration?: number;
  statuscode: FlowRunStatus;
  statecode: number;           // 0 = Active, 1 = Inactive
  errorcode?: string;
  errormessage?: string;
  errordetails?: string;
  triggertype?: number;
  ownerid?: string;
  processversion?: string;
  createdon: string;
}

export enum FlowRunStatus {
  NotSpecified = 0,
  Paused = 1,
  Running = 2,
  Waiting = 3,
  Succeeded = 4,
  Skipped = 5,
  Suspended = 6,
  Cancelled = 7,
  Failed = 8,
  Faulted = 9,
  TimedOut = 10,
  Aborted = 11,
  Ignored = 12,
  Deleted = 13,
  Terminated = 14,
}

export const FlowRunStatusLabel: Record<FlowRunStatus, string> = {
  [FlowRunStatus.NotSpecified]: 'Not Specified',
  [FlowRunStatus.Paused]: 'Paused',
  [FlowRunStatus.Running]: 'Running',
  [FlowRunStatus.Waiting]: 'Waiting',
  [FlowRunStatus.Succeeded]: 'Succeeded',
  [FlowRunStatus.Skipped]: 'Skipped',
  [FlowRunStatus.Suspended]: 'Suspended',
  [FlowRunStatus.Cancelled]: 'Cancelled',
  [FlowRunStatus.Failed]: 'Failed',
  [FlowRunStatus.Faulted]: 'Faulted',
  [FlowRunStatus.TimedOut]: 'Timed Out',
  [FlowRunStatus.Aborted]: 'Aborted',
  [FlowRunStatus.Ignored]: 'Ignored',
  [FlowRunStatus.Deleted]: 'Deleted',
  [FlowRunStatus.Terminated]: 'Terminated',
};
