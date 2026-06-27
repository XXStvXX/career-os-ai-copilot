# Roadmap

## Current Prototype

- Electron desktop shell
- Local JSON state
- Job tracking pool
- Job detail workflow
- Collector candidate inbox
- Human approval / rejection feedback
- Resume and cover-letter file routing
- Demo priority model

## Next Steps

### Collector Automation

- Add safer source adapters for job boards
- Store collector requests as local tasks
- Normalize job descriptions into structured fields
- Preserve original source links for every candidate
- Keep credentials outside the app

### JD Analysis

- Extract role type, tools, responsibilities, eligibility, location, duration, deadline, and risks
- Compare against personal preference rules
- Generate resume and cover-letter raw material
- Flag missing evidence before package generation

### Resume Package Workflow

- Add package readiness checklist
- Track which resume / cover letter files were reviewed
- Connect selected JD elements to resume bullet suggestions
- Keep manual approval before any final package is marked ready

### Reliability

- Add automated tests for scoring and state transitions
- Add import/export for demo state
- Add schema validation for runtime JSON
- Add a safer backup and restore interface

## Not A Goal Yet

Fully automated job application submission is not a current goal.

The nearer goal is a reliable local platform that helps a user decide what to apply for, organize package work, and track status without losing context.
