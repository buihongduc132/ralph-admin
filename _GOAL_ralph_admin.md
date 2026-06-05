# _GOAL_ralph_admin.md

Iteration {{iteration}}

## Working Directory

**THIS IS CRITICAL. READ CAREFULLY.**

You are working in **ONE location**:

| Location | Path | What you do here |
|----------|------|-----------------|
| **ralph-admin repo** | `/home/bhd/Documents/Projects/bhd/ralph-admin` | Write code, run tests, commit everything |

**Branch:** `main`
**State dir:** `/home/bhd/Documents/Projects/bhd/ralph-admin/.ralph-admin`
**Plan file:** `flow/plans/2026-06-04_ralph-admin.md` (in open-ralph-wiggum — READ ONLY reference)
**Intention file:** `flow/intentions/2026-06-04_ralph-admin.md` (in open-ralph-wiggum — READ ONLY reference)

**ALWAYS `cd` to `/home/bhd/Documents/Projects/bhd/ralph-admin` before writing code or running tests.**

## Goal

Implement `ralph-admin` — a PM2-integrated fleet manager for ralph loops.

**User verbatim:** "LIKE just forward parse, validate args then forward, do not try to re implement each of them"

**Core principle:** Least resistance. Lifecycle commands (pause/resume/stop/restart) = parse args → validate → `execFileSync('pm2', [...])`. Do NOT wrap PM2 in abstraction layers. Do NOT import the `pm2` npm package.

## Plan Reference

The plan lives in a SEPARATE repo. Do NOT copy it here. Read it when needed:

| File | Purpose |
|------|---------|
| `/home/bhd/Documents/Projects/bhd/open-ralph-wiggum/flow/plans/2026-06-04_ralph-admin.md` | Full implementation plan with 11 tasks, exact code, TDD-first |
| `/home/bhd/Documents/Projects/bhd/open-ralph-wiggum/flow/intentions/2026-06-04_ralph-admin.md` | Architecture decisions, command spec, risk table |

**Read the plan file for:** task IDs, code snippets, file paths, schema definitions, test cases, gotchas.
**This _GOAL defines:** workflow, rules, ceremonies, modulos. NOT the task list.

## Rules

- **_GOAL IMMUTABILITY**: NEVER modify this _GOAL file. Commit immediately on creation, never touch again.
- **Least resistance**: Lifecycle commands = 3-5 lines each. Inline in cli.ts. No `LifecycleManager` class. No `Pm2Client` class. `pm2-fwd.ts` = exported functions only.
- **No `pm2` npm package**: Use `execFileSync('pm2', [...])`. PM2 is already installed globally.
- **TDD**: Tests first, THEN implementation. Never write code before tests.
- **`bun test`** must pass with exit code 0.
- **Verifier loop** after each task — do NOT claim done without running tests + manual verification.
- **Commit** after each task completes. One task = one commit minimum.
- **OOP where it matters**: Only domains with real logic get classes (readers, doctor, scaffold, formatter). Lifecycle = inline.
- **DRY**: Schemas defined once in `src/schemas/`. No duplicate type definitions.
- **Check inventory** at `.ralph-admin/inventory.json` at start of EVERY iteration.
- **Kind A — Plan-Driven**: Follow the plan. Do NOT deviate from the task order or skip tasks.

## Workflow (per iteration)

### Step 1 — Context Recovery
Read inventory at `.ralph-admin/inventory.json`. Check git log. Check for demoted tasks, problem_notes, failing tests from previous iteration. Fix these FIRST before any new work.

### Step 2 — Pick Order (strict priority)
1. **Problems first**: demoted tasks, failing tests, verifier rejections
2. **Current task**: next incomplete task in the plan (Task 1 → 2 → 3 → ...)
3. **Coverage uplift**: if all tasks done, increase test coverage

MUST complete at least 1 engineering task per iteration. Probes do NOT count.

### Step 3 — Execute
- Read the task from the plan file
- Write tests FIRST (TDD)
- Implement the code
- Run `bun test` — must pass
- Commit
- Run verifier loop (self-review)

## Modulo Checkpoints

These run at the specified iteration intervals via `{{inject:modulo}}` in the _GOAL prompt.

### I % 5 == 0 — SYNC
1. Commit current progress
2. Update inventory at `.ralph-admin/inventory.json`
3. Run `bun test` — must pass with exit code 0
4. `git push`

### I % 7 == 0 — BACKWARD (READ-ONLY audit)
**READ-ONLY**: No implementation changes this iteration.

1. Run ALL tests — must pass
2. **Rotate audit lens** (pick a DIFFERENT lens each time):
   - **Lens 1 — Stubs/Fakes**: Hunt for hardcoded returns, `TODO` stubs, skipped tests, fake adapters
   - **Lens 2 — Plan Conformance**: Compare implementation against the plan file. Check for drift: over-engineering (extra classes, extra methods not in plan) or under-engineering (missing error handling, missing validation)
   - **Lens 3 — Least Resistance**: Is any lifecycle command using more than 5 lines? Is there a class that should be a function? Is there a wrapper wrapping a wrapper?
   - **Lens 4 — Schema Drift**: Compare local schemas in `src/schemas/` against actual ralph state files on disk. Are we reading fields that don't exist? Missing fields we should read?
3. If ANY finding → **demote** the affected task in inventory.json (set status to `in_progress`, add `problem_notes`)
4. Record all findings in inventory — the next forward iteration fixes them

### I % 11 == 0 — DEEP REVIEW
**READ-ONLY**: Deep audit of ONE task or area. Pick the task most at risk.
Full code review. Check for: error handling gaps, edge cases, race conditions.
Record all findings in inventory.

### I % 15 == 0 — CODING GUARD
Run `npx @anthropic-ai/cc-safety-net` or equivalent guard scan on the worktree.
Fix any violations found in the NEXT forward iteration.

## Worst First

Fix problems before starting new work:
1. Demoted tasks with `problem_notes`
2. Failing tests
3. Backward audit findings
4. Next incomplete task in plan
5. Coverage uplift

## Mandatories

- **Verifier loop**: After completing a task, run a self-review. Re-read the plan spec for that task. Verify every checkbox item.
- **Commit before complete**: Never claim a task done without committing.
- **`bun test` must pass**: No exceptions. If tests fail, the task is NOT done.
- **No `pm2` npm package**: If you catch yourself adding `import * as pm2 from "pm2"` — STOP. Use `execFileSync`.
- **No LifecycleManager class**: If you catch yourself creating a class for pause/resume/stop — STOP. Inline in cli.ts.
- **_GOAL immutability**: This file is NEVER modified after creation.

## Inventory

Tracked at `.ralph-admin/inventory.json` with tasks matching the plan:

| Phase | Tasks | Status |
|-------|-------|--------|
| P0 | Task 1 (scaffold), Task 2 (schemas+fixtures) | pending |
| P1 | Task 3 (config), Task 4 (readers), Task 5 (goal-reader) | pending |
| P2 | Task 6 (pm2-fwd), Task 7 (doctor), Task 8 (scaffold-builder) | pending |
| P3 | Task 9 (formatter), Task 10 (wire CLI), Task 11 (build+smoke) | pending |

## Future Enhancements (NOT in scope)

| Feature | Why deferred |
|---------|-------------|
| `pause --after-cycle` | Needs ralph engine `.pause-requested` sentinel |
| TUI dashboard | v0.1 is CLI only |
| Remote fleet | Needs SSH/agent protocol |

## Progress Tracking with State Transitions

**User intent:** "we like what items being TODO - WIP -> REVIEW -> reject -> WIP again"

Ralph loops write custom `*-state.json` files (e.g., `fix-state.json`, `wire-state.json`)
under `flow/plans/`. Each has items with a `status` field that moves through the lifecycle:

```
todo → wip → review → verified (done)
                  ↘ rejected → wip (rework)
```

### What ralph-admin must do

1. **Discover** all `*-state.json` files under `flow/plans/` (recursive)
2. **Read** item progress — normalize different schemas (`bugs[]`, `items[]`) into a unified view
3. **Track state changes over time** — detect when items move between statuses
4. **Identify regressions** — DONE/REVIEW → WIP/TODO/REJECTED means something went backward

### How it works

**`ralph-admin progress [name]`** — show item-level progress grouped by status phase.
**`ralph-admin progress --history`** — show full transition timeline.
**`ralph-admin progress --regressions`** — show only items that regressed.

**Transition tracking** is automatic via a file watcher daemon:
- `ralph-admin-watchd <project-dir>` watches `flow/plans/` for `*-state.json` writes
- On any change, diffs against last snapshot, appends transitions to `.transitions.jsonl`
- Flags regressions in real-time
- Run as PM2 process alongside ralph loops

**Key files:**
- `src/schemas/goal-state.ts` — `TrackedItem`, `canonicalPhase()`, `isRegression()`
- `src/readers/goal-state-reader.ts` — discovers and reads `*-state.json` files
- `src/watchd.ts` — file watcher daemon
- `src/cli.ts` — `progress` command reads `.transitions.jsonl` for display

**Regression = any transition that moves backward in the lifecycle.**
A verified item being rejected is a regression. A rejected item going back to wip is NOT — that's rework (forward).
