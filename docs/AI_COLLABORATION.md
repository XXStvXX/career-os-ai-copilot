# AI Collaboration And Build Provenance

This project is intentionally transparent about AI involvement.

## Human Contribution

- The original problem and product direction
- Workflow requirements from a real job search
- Prioritization logic for sources and job fit
- Human review of role attractiveness and risk
- Iterative feedback on interface structure
- Decisions about what should remain manual versus automated

The human contribution was mainly product ownership: deciding what mattered, what should be simplified, what should be automated later, and what should remain under manual review.

## AI Coding Agent Contribution

- Electron app scaffolding
- UI implementation in HTML, CSS, and JavaScript
- Local JSON persistence patterns
- Candidate scoring and preference-rule implementation
- Documentation drafts
- Refactoring and privacy-safe packaging
- Debugging broken interactions

The AI coding agent carried a large share of the implementation work. This repository should be read as an AI-led build guided by human judgment, not as a claim of fully manual coding.

## Why This Matters

The project is not presented as a traditional solo software engineering artifact.

It is presented as an example of AI-native building: a user with domain context and product judgment collaborates with an AI coding agent to create a working local tool.

That is part of the point. The project demonstrates:

- Clear product thinking
- Ability to guide and evaluate technical work
- Ability to review and correct AI output
- Ability to turn an ambiguous personal workflow into a structured system
- Ability to preserve human review where automation would be risky

## Human-In-The-Loop Boundary

The app does not automatically apply to jobs.

The intended workflow is:

1. Collect job descriptions.
2. Score and summarize them.
3. Ask the user to approve or reject.
4. Use feedback to improve future filtering.
5. Organize resume and cover-letter package work.
6. Track application status manually or semi-automatically.

Automation is useful here only when it preserves human judgment.
