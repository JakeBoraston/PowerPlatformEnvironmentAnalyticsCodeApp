/**
 * Dataverse `workflow` table — stores flow/process definitions.
 * Filter by `category eq 5` for cloud flows (Power Automate).
 *
 * Once `pac code add-data-source -a dataverse -t workflow` is run,
 * the auto-generated model will supersede this manual type.
 */
export interface Workflow {
  workflowid: string;
  name: string;
  category: WorkflowCategory;
  statecode: number;       // 0 = Draft, 1 = Activated, 2 = Suspended
  statuscode: number;
  description?: string;
  ownerid?: string;
  primaryentity?: string;
  mode?: number;           // 0 = Background, 1 = Real-time
  scope?: number;
  createdon: string;
  modifiedon: string;
  uniquename?: string;
}

export enum WorkflowCategory {
  Workflow = 0,
  Dialog = 1,
  BusinessRule = 2,
  Action = 3,
  BusinessProcessFlow = 4,
  ModernFlow = 5,          // Cloud flows (Power Automate)
  DesktopFlow = 6,
  AIFlow = 7,
}

export enum WorkflowState {
  Draft = 0,
  Activated = 1,
  Suspended = 2,
}
