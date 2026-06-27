# Career OS AI Copilot

A local-first Electron prototype for managing a personal co-op / internship job search workflow.

This project is intentionally scoped as a **personal-use productivity platform**, not a polished SaaS product and not a fully automated application bot. It grew out of a real need: keeping job descriptions, approval decisions, resume package work, source links, and application status in one approachable interface instead of scattered Markdown files and browser tabs.

## Current Status

This is a working local prototype with demo data.

Implemented:

- Local Electron desktop shell
- Multi-page dashboard with a collapsible sidebar
- Unified job tracking pool with order-style rows
- Job detail workflow for approval, processing, and submitted states
- Resume / cover letter package workspace folders
- Document pool upload routing
- Collector inbox for human approval and preference training
- Priority model that favors school portal roles, junior-friendly scopes, and small creative teams over company-name prestige
- Local JSON state persistence

In progress:

- Automated collector modules for school portals and public job boards
- Richer JD parsing into resume and cover-letter raw material
- Better privacy-safe import/export workflows
- More robust tests and packaging

## Important Scope Note

This repo contains a **public-safe demo version**. Real job data, school portal links, personal documents, runtime state, archived state, and application materials are intentionally excluded.

The original working version is used locally for one person's job search. This public version is meant to show the system design, product thinking, and implementation direction without exposing private information.

## AI Collaboration Disclosure

This project was built through substantial AI collaboration.

My role:

- Defined the product need and workflow
- Described the interface and interaction model
- Set job-search priorities and decision rules
- Reviewed outputs and corrected direction
- Supplied domain judgment about what roles were realistic or attractive

AI coding assistant role:

- Translated requirements into Electron / HTML / CSS / JavaScript implementation
- Iterated UI structure and local-state logic
- Helped design the collector, scoring, and tracking architecture
- Generated and revised documentation
- Assisted with debugging, packaging, and privacy review

I do not present this as a solo hand-coded engineering project. It is a realistic example of how I use AI tools as a force multiplier: turning a messy personal workflow into a structured, inspectable, locally running prototype while keeping human judgment in the loop.

## Why This Project Exists

Traditional job-search tracking tools often assume a simple spreadsheet workflow. My actual workflow needed more structure:

- A job can be collected before it is approved.
- Approval needs a human reason, because that reason trains future filtering.
- A job package needs files, folders, resume versions, and source links.
- Application status should move like an order-tracking pipeline.
- Personal fit is not only about keywords. It includes source quality, beginner friendliness, location, duration, and whether the role fits a first co-op search.

Career OS turns that into a small local platform.

## Architecture

```text
Career OS AI Copilot
├── electron/
│   ├── main.js          # Electron main process and filesystem IPC
│   └── preload.js       # Safe renderer bridge
├── dashboard/
│   ├── index.html       # App shell
│   ├── career-software.css
│   ├── career-software-app.js
│   └── career-software-data.js  # Public-safe demo seed data
├── runtime_state/       # Local generated state, ignored by git
├── runtime_requests/    # Local collector requests, ignored by git
├── job_workspaces/      # Local generated package folders, ignored by git
├── document_pool/       # Local uploaded documents, ignored by git
└── docs/
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Run Locally

```bash
npm install
npm start
```

Check syntax:

```bash
npm run check
```

## Privacy Model

This app is designed to be local-first.

- No passwords are stored.
- Login-based sources are expected to be opened manually by the user.
- Runtime state lives in local JSON files.
- Uploaded documents stay in local folders.
- Real job records and personal materials should not be committed.

See [docs/PRIVACY.md](docs/PRIVACY.md).

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md).

## Recruiter-Facing Summary

This project demonstrates:

- Product thinking from an ambiguous personal workflow
- Local app architecture with Electron
- Human-in-the-loop automation design
- Data modeling for jobs, candidates, decisions, and application states
- Practical AI collaboration rather than pretending AI was not involved

The automation modules are still early. The value of the current repo is the workflow architecture and iterative prototype, not a claim that job applications are fully automated.
