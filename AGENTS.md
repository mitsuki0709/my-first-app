# Codex project instructions

## Mission

Act as the planning/research agent or development project agent for **期限みまもり**, according to the user's request and the current opportunity status. Move the project forward with as little user back-and-forth as practical while keeping important product, cost, security, and deployment decisions with the user.

The user's explicit instruction always overrides this file.

## Project map

- `README.md` — product behavior, manual test notes, developer commands.
- `index.html` — page structure.
- `app.js` — application logic, local persistence, JAN validation, camera scanning.
- `styles.css` — UI styles.
- `tests/app.test.js` — automated regression tests.
- `docs/PROJECT_STATE.md` — current objective, known state, constraints, and next priorities. Keep it current.
- `docs/RESEARCH_STATE.md` — active discovery theme, evidence, hypotheses, comparison, and next research step.
- `docs/OPPORTUNITY_BACKLOG.md` — opportunity scores, confidence, and discovery status.
- `docs/REJECTED_IDEAS.md` — rejected/deferred ideas and their reconsideration conditions.
- `docs/PROJECT_BRIEF.md` — the leading opportunity's handoff draft. Its presence alone never authorizes development.
- `.agents/skills/planning-research-agent/SKILL.md` — autonomous discovery, research, evaluation, validation planning, and handoff workflow.
- `.agents/skills/development-project-manager/SKILL.md` — autonomous development workflow. Use it for implementation, bug fixing, continuation, prioritization, and release-readiness work.

## Work-mode routing

- Use the planning/research skill when the user asks what to build, brings an idea to evaluate, requests market/competitor research, or asks to advance an opportunity that is `DISCOVERY`, `RESEARCHING`, `VALIDATE`, or `HOLD`.
- Use the development skill for fixes and improvements within the existing approved product scope.
- New-opportunity feature development may start only when the backlog and brief both say `READY_FOR_MVP`, the required evidence is recorded, and any approval required below has been obtained.
- A `PROJECT_BRIEF.md` in `VALIDATE` is a validation design and possible future handoff, not an implementation order. Do not implement its feature list.

## Default operating mode

1. Read `docs/PROJECT_STATE.md`, `README.md`, and the relevant code/tests before changing anything.
2. Infer reasonable implementation details from the existing product and code instead of asking about minor choices.
3. Prefer the smallest safe change that satisfies the goal. Do not rewrite working areas without a concrete reason.
4. Break the goal into ordered tasks and continue through them without asking for confirmation between ordinary subtasks.
5. Implement, test, inspect failures, repair, and retest before reporting back.
6. Add or update tests when behavior changes.
7. Update `docs/PROJECT_STATE.md` when the project state, known issues, or priorities change.
8. Report only meaningful outcomes, unresolved blockers, and any decision that genuinely requires the user.

For planning/research work, follow the state and evidence workflow in `.agents/skills/planning-research-agent/SKILL.md` instead of treating research output as an approved development backlog.

## Decisions you may make autonomously

Proceed without asking when the choice is reversible and stays within the existing product scope, including:

- bug fixes and reliability improvements;
- implementation details and code organization;
- small usability improvements that do not change the product concept;
- tests, test fixtures, comments, and documentation;
- refactoring needed to complete a task while preserving behavior;
- choosing the simplest no-cost approach among equivalent options.

Do not stop merely because there are multiple technically reasonable implementations. Choose one, document the important tradeoff if needed, and continue.

## Decisions that require user approval

Stop and ask only when work would materially change one of these areas:

- introducing a paid service, recurring cost, or purchase;
- introducing an external API/service or major third-party dependency that changes privacy, cost, or operational risk;
- handling credentials, secrets, authentication accounts, or permissions the user must grant;
- deleting or irreversibly migrating user data;
- materially changing the product's target user, core purpose, or business model;
- moving a validated opportunity into development when doing so would materially change the current product scope or target user;
- changing repository visibility or other consequential repository/account settings;
- merging into the default branch, publishing a production release, or performing another consequential external action unless the user explicitly authorized it;
- a blocker remains after three materially different, evidence-based repair attempts.

For iPhone/Safari camera behavior that cannot be validated automatically, finish all automated work first, then request one concise real-device check with exact steps.

## Validation rules

For code changes, run the relevant automated checks before considering the task complete. The current baseline test command is:

```bash
node --test tests/app.test.js
```

Also inspect the final diff/status and check for regressions in adjacent core flows. Never claim a real-device camera test passed unless it was actually performed on a device.

## Product constraints

- Keep the solution low-cost; prefer approaches that require no additional paid services.
- Preserve the existing privacy-friendly local processing/storage model unless the user approves a change.
- Avoid unnecessary dependencies and infrastructure.
- Core user value and reliability take priority over visual polish.

## Safety and Git discipline

- Never expose or commit secrets.
- Avoid destructive Git operations and force-pushes unless explicitly requested.
- Preserve unrelated user changes.
- Keep changes reviewable and scoped to the current goal.
