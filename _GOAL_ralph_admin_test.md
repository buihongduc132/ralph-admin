# _GOAL_ralph_admin_test.md

Iteration {{iteration}}

## Working Directory

| Location | Path | What you do here |
|----------|------|-----------------|
| **ralph-admin repo** | `/home/bhd/Documents/Projects/bhd/ralph-admin` | Write code, run tests, commit everything |

**Branch:** `main`
**State dir:** `/home/bhd/Documents/Projects/bhd/ralph-admin/.ralph-test`
**Binary:** `/home/bhd/Documents/Projects/bhd/ralph-admin/bin/ralph-admin`

**ALWAYS `cd` to `/home/bhd/Documents/Projects/bhd/ralph-admin` before running commands.**

## Goal

**Test `ralph-admin` against real PM2.** The code is already implemented. Your job is to run the CLI binary against the actual PM2 fleet and verify every command works.

**Plan ref:** `/home/bhd/Documents/Projects/bhd/open-ralph-wiggum/flow/plans/2026-06-04_ralph-admin.md`

## Rules

- **_GOAL IMMUTABILITY**: NEVER modify this file.
- **Test the ACTUAL binary**: Run `./bin/ralph-admin <command>` — not `bun run src/cli.ts`.
- **Every command must be tested**: list, status, doctor, pause, resume, stop, restart, inventory, inject-header, bootstrap --help, start --help, --help.
- **Report results**: For each command, show the command you ran AND the output. If it fails, diagnose and fix.
- **Record findings in inventory** at `.ralph-test/inventory.json`.

## Workflow

### Cycle 1 — Smoke test all commands
1. Run `./bin/ralph-admin --help` — verify all commands listed
2. Run `./bin/ralph-admin list` — verify shows real ralph processes from PM2
3. Run `./bin/ralph-admin doctor` — verify health check works
4. Run `./bin/ralph-admin status <name>` on a real loop — verify reads state file
5. Run `./bin/ralph-admin inventory <name>` on a real loop — verify reads inventory
6. Run `./bin/ralph-admin bootstrap --help` — verify options shown
7. Run `./bin/ralph-admin start --help` — verify options shown
8. Run `./bin/ralph-admin inject-header <name>` — verify idempotent
9. Record all results in inventory

### Cycle 2 — Test lifecycle against a disposable process
1. Create a dummy PM2 process: `pm2 start bash --name ralph-test-probe -- -c "sleep 9999"`
2. Create a fake state dir: `mkdir -p /tmp/ralph-test-probe/.ralph-test-probe && echo '{"active":true,"iteration":5,"model":"test"}' > /tmp/ralph-test-probe/.ralph-test-probe/ralph-loop.state.json`
3. Run `./bin/ralph-admin pause test-probe` — verify pm2 stop (process stays registered)
4. Run `pm2 list | grep ralph-test-probe` — verify still registered but stopped
5. Run `./bin/ralph-admin resume test-probe` — verify pm2 restart (picks up)
6. Run `pm2 list | grep ralph-test-probe` — verify online again
7. Run `./bin/ralph-admin stop test-probe` — verify pm2 delete (removed from registry)
8. Run `pm2 list | grep ralph-test-probe` — verify gone
9. Record all results in inventory

### Cycle 3 — Final verification + fix any issues
1. Re-run ALL tests from cycles 1 and 2
2. Fix any bugs found
3. Run `bun test` — must still pass
4. Commit any fixes
5. Record final results in inventory

## Inventory

Tracked at `.ralph-test/inventory.json`:

| Phase | Tasks | Status |
|-------|-------|--------|
| P1 | Smoke test all commands (help, list, doctor, status, inventory) | pending |
| P2 | Lifecycle test (pause/resume/stop against real PM2) | pending |
| P3 | Final verification + bug fixes | pending |
