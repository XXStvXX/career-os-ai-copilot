# Privacy And Local-First Scope

This public repository uses demo data.

The real working version of this app may contain:

- Job descriptions from logged-in portals
- Source links
- Personal preferences
- Resume and cover-letter drafts
- Application notes
- Local uploaded files

Those files should not be committed.

## Ignored Runtime Paths

The `.gitignore` excludes local runtime data:

- `runtime_state/*.json`
- `runtime_requests/*.json`
- `job_workspaces/*`
- `document_pool/*`
- `archives/`
- `node_modules/`

README files may remain in runtime folders so the folder purpose is documented.

## Credentials

The app does not store passwords.

For login-based sources, the intended workflow is manual user login followed by local collection or review. Any future source adapter should preserve that boundary unless a secure credential model is explicitly designed.

## Public Demo Principle

When sharing this project publicly:

- Use anonymized jobs.
- Use `example.com` source links.
- Remove real school portal data.
- Remove personal application materials.
- Keep AI collaboration disclosure visible.
