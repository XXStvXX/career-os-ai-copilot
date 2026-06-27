# Architecture

Career OS AI Copilot is a local-first Electron app with a simple renderer and JSON-backed state.

## Layers

### Electron Main Process

`electron/main.js` owns local filesystem access:

- Reads and writes runtime state
- Creates job package folders
- Copies uploaded resume / cover-letter files into the correct workspace
- Opens local folders and external URLs

### Preload Bridge

`electron/preload.js` exposes a narrow API to the renderer through `contextBridge`.

The renderer does not receive direct Node access. It calls methods such as:

- `readState`
- `writeState`
- `ensureJobFolder`
- `savePackageFiles`
- `saveDocumentFiles`
- `openUrl`

### Renderer App

`dashboard/career-software-app.js` contains the dashboard behavior:

- Navigation and page rendering
- Job pool sorting and detail views
- Collector candidate approval / rejection
- Learned preference rules
- Application status transitions
- Local fallback through `localStorage` when Electron APIs are unavailable

### Demo Seed Data

`dashboard/career-software-data.js` contains public-safe demo jobs and collector rules.

Real runtime data is intentionally not included.

## Data Model

Primary entities:

- `job`: a tracked job in the active pool
- `collector.candidate`: a collected job before or during approval
- `collector.labeledSamples`: user feedback examples
- `collector.learnedRules`: preference rules extracted from approval/rejection notes
- `packageFiles`: resume / cover-letter files attached to a job
- `documentUploads`: reusable application documents
- `requests`: local requests for future collector runs

## Priority Model

The prototype uses a human-in-the-loop priority model:

1. Deadline remains important.
2. School co-op portal roles receive source priority.
3. Small creative teams and junior-friendly scopes receive strong boosts.
4. Large-company prestige alone does not drive priority.
5. Pure CS-heavy roles are treated cautiously unless the JD clearly connects to data, AI workflow, or analysis.

This is not meant to be a universal scoring model. It reflects one user's current search strategy.
