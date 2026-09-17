# Platform Analytics

A read-only Power Apps code app that shows the health of one Power Platform
environment: cloud flows and their runs, failures, canvas and model-driven apps,
solutions and their import history, Copilot Studio agents, connection
references, environment variables, system jobs and users.

It reads only the system tables every Dataverse environment already has. There
is no solution to import first, no custom table, no connector and no tenant
configuration in the code, so the same source deploys to any environment.

## Before you deploy

- **Code apps enabled.** In the Power Platform admin center, open the
  environment, then Settings > Product > Features, and turn on
  *Enable code apps*.
- **Licences.** People who open the app need Power Apps Premium.
- **Security role.** System Administrator is the only built-in role Microsoft
  documents as reading all of the tables below across the environment. With a
  narrower role, people see only what their role can read, and the affected
  sections say they could not load. For least privilege, copy Basic User and add
  organisation-level Read on the tables below, then test it in a non-production
  environment. Agent conversation figures also need Bot Transcript Viewer, which
  only an admin can assign.
- **Flow run history.** Runs are only recorded for flows whose owner has Read on
  the Flow Run table, and are kept for 28 days by default.
- **Copilot Studio.** The agent pages need Copilot Studio's tables. Where they
  don't exist, those pages say so and the rest of the app works as normal.

Tables read: `workflow`, `flowrun`, `canvasapp`, `appmodule`, `solution`,
`solutioncomponent`, `msdyn_solutionhistory`, `bot`, `botcomponent`,
`conversationtranscript`, `systemuser`, `connectionreference`,
`environmentvariabledefinition`, `environmentvariablevalue`, `asyncoperation`.

## Deploy to a new environment

Requires Node.js 20.19 or later (the minimum for Vite 7).

1. `npm install`
2. `npx power-apps login` and sign in to the target tenant.
3. In `power.config.json`, set `environmentId` to your environment's ID. Leave
   `appId` empty; the first push creates the app and records its ID there. To
   keep configs for several environments, copy it to `power.config.<name>.json`
   (those are gitignored) and swap the one you need into place.
4. `npx power-apps refresh-data-source` to regenerate the table schemas against
   your environment.
5. `npm run build`
6. `npx power-apps push`. Add `--solution-id <guid>` to place the app in a
   specific solution; without it the first push uses the environment's
   preferred solution.

To move the app on from there (development to test to production), add it to a
solution and promote that solution with export and import or Power Platform
Pipelines.

## Local development

```bash
npm install
npm run dev     # prints a Local Play URL that opens the app inside Power Apps
npm run check   # type and accessibility checks
```

Open the **Local Play** URL the dev server prints, not `localhost`. The app
needs the Power Apps host to reach Dataverse.
