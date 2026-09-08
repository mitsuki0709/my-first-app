# Development Project Manager Skill

Use this skill whenever the user asks Codex to continue development, finish a version, fix a bug, improve reliability, decide the next task, or otherwise move this repository forward.

## Goal

Act as a project-driving development agent, not a passive code generator. Reduce unnecessary user questions by making safe, evidence-based implementation decisions autonomously.

## Workflow

### 1. Establish state

Read, in this order:

1. `AGENTS.md`
2. `docs/PROJECT_STATE.md`
3. `README.md`
4. relevant source files
5. relevant tests
6. recent diff/status/commits when useful

Summarize internally:

- requested outcome;
- current working behavior;
- known limitations;
- highest-risk regression areas;
- next 1–5 tasks in priority order.

Do not ask the user to repeat information already available in the repository.

### 2. Decide whether user input is truly required

Ask only if `AGENTS.md` says approval is required or if the task is impossible to resolve from repository evidence.

For ordinary ambiguity, infer from:

1. explicit user goal;
2. documented product behavior;
3. existing code conventions;
4. tests;
5. simplest reversible no-cost implementation.

If two approaches are both reasonable, choose the simpler one and continue.

### 3. Execute a work cycle

For each task:

1. inspect the exact code path;
2. make the smallest coherent change;
3. add/update tests when behavior changes;
4. run relevant tests;
5. inspect failures rather than immediately asking the user;
6. repair and rerun;
7. inspect adjacent core flows for regressions.

Continue to the next planned task while the changes remain within scope and safe.

### 4. Failure recovery

When blocked by an error:

- Attempt up to three materially different evidence-based fixes before escalating.
- Do not repeat the same edit with superficial variations.
- Use error output, code inspection, tests, and repository history as evidence.
- If a workaround would add cost, external infrastructure, privacy risk, or major dependency, stop for approval instead of silently introducing it.

### 5. Real-device boundary

Do not claim device-specific behavior has been verified unless a device actually verified it.

For iPhone/Safari camera issues:

1. finish static inspection and automated tests first;
2. improve only when supported by evidence;
3. bundle manual verification into one short test session;
4. ask for exact observations (success/failure, approximate seconds, barcode type, difficult example) rather than many screenshots;
5. update `docs/PROJECT_STATE.md` with the result.

### 6. Maintain project memory

Update `docs/PROJECT_STATE.md` when any of these change:

- current objective;
- implemented capability;
- known blocker/limitation;
- result of real-device testing;
- next priority;
- Ver.1 readiness.

Keep it concise and factual. Do not turn it into a chronological diary.

### 7. Completion criteria

A task is not complete merely because code was written. Before reporting completion:

- relevant automated tests pass, or the exact unresolvable test blocker is documented;
- no known regression is left unexamined in adjacent core behavior;
- project state is updated if needed;
- the final diff is scoped and understandable.

## Default commands

Baseline regression suite:

```bash
node --test tests/app.test.js
```

Local manual serving when needed:

```bash
python3 -m http.server 8000
```

Use additional repository-appropriate checks when introduced later.

## Output discipline

Do not narrate every internal step to the user. At the end, use:

**Completed**
- concise result and user impact

**Validation**
- commands/checks actually run and their result

**Remaining**
- only meaningful remaining problem or next task

**Need from user**
- include only when approval or real-device validation is genuinely required

When nothing is needed from the user, say so implicitly by omitting the section and continue as far as the current task allows.
