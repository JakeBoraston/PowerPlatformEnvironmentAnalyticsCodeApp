import { writable, get } from 'svelte/store';
import { getContext } from '@microsoft/power-apps/app';

export const powerContextReady = writable(false);

/** The current environment ID, resolved dynamically from the SDK context. */
export const environmentId = writable<string>('');

/**
 * Brings up the Power Apps SDK.
 *
 * The client library used to expose an explicit `initialize()`. From v1 that is
 * gone: the Vite plugin injects the bootstrap and `getContext()` resolves once
 * the host is ready, so awaiting it is the readiness signal.
 *
 * Everything downstream keys off `powerContextReady`, including the lazy data
 * loaders, so this has to resolve before any data can load.
 */
/**
 * Outside the Power Apps host `getContext()` never settles, so without a limit
 * the app sits on its loading screen forever. After this long it renders
 * anyway and each data source reports its own failure.
 */
const HOST_TIMEOUT_MS = 15000;

export async function initPowerApps() {
  try {
    const ctx = await Promise.race([
      getContext(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Power Apps host did not respond')), HOST_TIMEOUT_MS)
      ),
    ]);
    if (ctx?.app?.environmentId) {
      environmentId.set(ctx.app.environmentId);
    }
  } catch {
    // No host context: plain local dev outside the harness, or a host that
    // timed out. Render rather than hang on the loading gate; data calls then
    // fail individually and surface through each store's error state.
  } finally {
    powerContextReady.set(true);
  }
}

/**
 * Build a Power Automate flow run URL for the current environment.
 *
 * Power Automate uses the run `name` (e.g. "08584276744338630472689981453CU06")
 * as the run identifier in URLs, NOT the Dataverse `flowrunid` GUID.
 */
export function getFlowRunUrl(workflowId: string, runName: string): string {
  const envId = get(environmentId);
  if (!envId || !workflowId || !runName) return '#';
  return `https://make.powerautomate.com/environments/${envId}/flows/${workflowId}/runs/${runName}?v3=false`;
}

/**
 * Build a Power Automate flow details URL for the current environment.
 * Opens the flow itself (not a specific run) in the maker portal.
 */
export function getFlowUrl(workflowId: string): string {
  const envId = get(environmentId);
  if (!envId || !workflowId) return '#';
  return `https://make.powerautomate.com/environments/${envId}/flows/${workflowId}/details`;
}

/**
 * Build a Copilot Studio agent URL for the current environment.
 * `botId` is the Dataverse `botid` GUID. Verified format per Microsoft Learn:
 * https://copilotstudio.microsoft.com/environments/{guid}/bots/{guid}
 */
export function getAgentUrl(botId: string): string {
  const envId = get(environmentId);
  if (!envId || !botId) return '#';
  return `https://copilotstudio.microsoft.com/environments/${envId}/bots/${botId}`;
}
