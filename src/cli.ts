#!/usr/bin/env bun
import { Command } from "commander";
import { existsSync } from "fs";
import * as pm2 from "./pm2-fwd";
import { resolveConfig } from "./config";
import { StateReader } from "./readers/state-reader";
import { InventoryReader } from "./readers/inventory-reader";
import { RulesReader } from "./readers/rules-reader";
import { GoalFileManager } from "./readers/goal-reader";
import { ScaffoldBuilder } from "./scaffold";
import { Doctor } from "./doctor";
import { formatListTable, formatDoctorOutput, formatUptime, formatStatus, formatGoalProgress } from "./formatter";
import { GoalStateReader } from "./readers/goal-state-reader";
import { isRegression, canonicalPhase } from "./schemas/goal-state";

const program = new Command()
  .name("ralph-admin")
  .description("PM2-integrated ralph fleet manager")
  .version("0.1.0");

// ── list ───────────────────────────────────────────────────
program.command("list").description("Show all ralph loops").action(() => {
  const procs = pm2.listRalph();
  const rows = procs.map(p => {
    const bare = p.name.replace(/^ralph-/, "");
    let iteration = 0;
    let model = "";
    let progress = "N/A";
    try {
      const cfg = resolveConfig(bare, p.cwd);
      const state = new StateReader(cfg.stateFile).read();
      if (state) {
        iteration = state.iteration;
        model = state.model;
      }
      const inv = new InventoryReader(cfg.inventoryFile).read();
      if (inv) {
        progress = new InventoryReader("").formatProgress(inv);
      }
    } catch { /* state files may not exist */ }
    return {
      name: p.name,
      status: p.status,
      iteration,
      model,
      progress,
      uptime: formatUptime(p.uptime > 0 ? Date.now() - p.uptime : 0),
      restarts: p.restarts,
    };
  });
  console.log(formatListTable(rows));
});

// ── status ─────────────────────────────────────────────────
program.command("status <name>").description("Detailed status of one loop").action((name: string) => {
  const procs = pm2.listRalph();
  pm2.assertExists(procs, name);
  const proc = pm2.findByName(procs, name)!;
  const bare = proc.name.replace(/^ralph-/, "");
  const cfg = resolveConfig(bare, proc.cwd);

  console.log(`Process:   ${proc.name}`);
  console.log(`Status:    ${formatStatus(proc.status)}`);
  console.log(`PID:       ${proc.pid}`);
  console.log(`Restarts:  ${proc.restarts}`);
  console.log(`Uptime:    ${formatUptime(proc.uptime > 0 ? Date.now() - proc.uptime : 0)}`);
  console.log(`CWD:       ${proc.cwd}`);

  const state = new StateReader(cfg.stateFile).read();
  if (state) {
    console.log(`\nIteration: ${state.iteration}/${state.maxIterations}`);
    console.log(`Model:     ${state.model}`);
    console.log(`Active:    ${state.active}`);
    console.log(`NoProgress: ${state.noProgress ?? 0}`);
    console.log(`Started:   ${state.startedAt}`);
    console.log(`Elapsed:   ${new StateReader("").elapsedHours(state).toFixed(1)}h`);
  } else {
    console.log(`\nState file not found: ${cfg.stateFile}`);
  }

  const inv = new InventoryReader(cfg.inventoryFile).read();
  if (inv) {
    console.log(`\nPhase:     ${inv.currentPhase}`);
    console.log(`Progress:  ${new InventoryReader("").formatProgress(inv)}`);
  }

  const rules = new RulesReader(cfg.rulesFile).read();
  if (rules) {
    const modulos = new RulesReader("").getActiveModulos(rules);
    console.log(`\nModulos:   ${modulos.map(m => `I%${m.at}`).join(", ")}`);
  }

  // Discover and show goal state files (custom *-state.json)
  const goalReader = new GoalStateReader();
  const goalStates = goalReader.discoverAll(proc.cwd);
  if (goalStates.length > 0) {
    console.log(`\nGoal State Files (${goalStates.length}):`);
    for (const gs of goalStates) {
      const done = gs.items.filter(i => i.phase === "DONE").length;
      const total = gs.items.length;
      // Read transition log if exists
      const logPath = gs.filePath.replace(/\.json$/, ".transitions.jsonl");
      let regStr = "";
      if (existsSync(logPath)) {
        try {
          const { readFileSync } = require("fs");
          const lines = readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
          let regressions = 0;
          for (const line of lines) {
            try { const t = JSON.parse(line); if (isRegression(t.from, t.to)) regressions++; } catch { /* skip */ }
          }
          if (regressions > 0) regStr = ` ⚠️ ${regressions} regressions`;
        } catch { /* ignore */ }
      }
      console.log(`  ${gs.name} (${gs.kind}): ${done}/${total} done${regStr}`);
    }
  }
});

// ── bootstrap ─────────────────────────────────────────────
program.command("bootstrap <name>")
  .description("Init loop (worktree + state + rules + _GOAL header) WITHOUT starting")
  .option("--source-repo <path>", "Source git repo", process.cwd())
  .action((name: string, opts: { sourceRepo: string }) => {
    const procs = pm2.listRalph();
    if (pm2.findByName(procs, name)) {
      throw new Error(`${pm2.derivePm2Name(name)} is already running in PM2. Stop it first.`);
    }

    const cfg = resolveConfig(name, opts.sourceRepo);
    const builder = new ScaffoldBuilder();

    // Create state dir with rules + inventory
    const { created, skipped } = builder.scaffoldStateDir(cfg.stateDir, name);

    // Find and inject header into _GOAL if it exists in source repo
    const goalMgr = new GoalFileManager(opts.sourceRepo);
    const goalFile = goalMgr.findGoalFile();
    if (goalFile) {
      console.log(`Found _GOAL: ${goalFile}`);
      // Only inject if we have a worktree; for now, source repo IS the worktree
      goalMgr.injectHeader(name, {
        worktreePath: opts.sourceRepo,
        stateDir: cfg.stateDir,
        branch: cfg.branch,
      });
    }

    console.log(`Bootstrapped ${name}:`);
    console.log(`  State dir: ${cfg.stateDir}`);
    console.log(`  PM2 name:  ${cfg.pm2Name}`);
    console.log(`  Branch:    ${cfg.branch}`);
    for (const f of created) console.log(`  Created:   ${f}`);
    for (const f of skipped) console.log(`  Skipped:   ${f} (exists)`);
    console.log(`\nNext: ralph-admin start ${name}`);
  });

// ── start ─────────────────────────────────────────────────
program.command("start <name>")
  .description("Start ralph loop via PM2 (must bootstrap first)")
  .option("--model <model>", "Model", "bhd-litellm/role-smart")
  .option("--agent <agent>", "Agent", "pi")
  .option("--reuse-state", "Reuse state", false)
  .option("--commit", "Enable commits", false)
  .option("--max-iterations <n>", "Max iterations", "999")
  .action((name: string, opts: { model: string; agent: string; reuseState: boolean; commit: boolean; maxIterations: string }) => {
    const cfg = resolveConfig(name, process.cwd());
    if (!existsSync(cfg.stateDir)) {
      throw new Error(`Not bootstrapped. Run 'ralph-admin bootstrap ${name}' first.`);
    }

    // Find _GOAL in worktree
    const goalMgr = new GoalFileManager(cfg.worktreePath);
    const goalFile = goalMgr.findGoalFile();
    if (!goalFile) {
      throw new Error(`No _GOAL file found in ${cfg.worktreePath}. Add one first.`);
    }

    const builder = new ScaffoldBuilder();
    const bashCmd = builder.buildStartCommand({
      name,
      worktreePath: cfg.worktreePath,
      stateDirName: cfg.stateDirName,
      goalFile,
      model: opts.model,
      reuseState: opts.reuseState,
    });

    const pm2Name = pm2.derivePm2Name(name);
    pm2.pm2StartRalph({ name: pm2Name, bashCommand: bashCmd, cwd: cfg.worktreePath });
    const { pid } = pm2.verifyStarted(pm2Name);
    console.log(`Started ${pm2Name} (pid ${pid})`);
  });

// ── pause ─────────────────────────────────────────────────
program.command("pause <name>").description("Pause at PM2 level (keep registered)").action((name: string) => {
  const procs = pm2.listRalph();
  pm2.assertExists(procs, name);
  const pm2Name = pm2.derivePm2Name(name);
  const proc = pm2.findByName(procs, name)!;
  let iteration = "?";
  try {
    const bare = proc.name.replace(/^ralph-/, "");
    const cfg = resolveConfig(bare, proc.cwd);
    const state = new StateReader(cfg.stateFile).read();
    if (state) iteration = String(state.iteration);
  } catch { /* ignore */ }
  pm2.pm2Stop(pm2Name);
  console.log(`Paused ${pm2Name} (was iteration ${iteration})`);
});

// ── resume ─────────────────────────────────────────────────
program.command("resume <name>").description("Resume paused loop via PM2").action((name: string) => {
  const pm2Name = pm2.derivePm2Name(name);
  pm2.pm2Restart(pm2Name);
  const { pid } = pm2.verifyStarted(pm2Name);
  console.log(`Resumed ${pm2Name} (pid ${pid})`);
});

// ── stop ───────────────────────────────────────────────────
program.command("stop <name>").description("Full stop — delete from PM2 (files kept)").action((name: string) => {
  const pm2Name = pm2.derivePm2Name(name);
  pm2.pm2Stop(pm2Name);
  pm2.pm2Delete(pm2Name);
  console.log(`Stopped and removed ${pm2Name} from PM2. State files preserved on disk.`);
});

// ── restart ────────────────────────────────────────────────
program.command("restart <name>").description("Hard restart via PM2").action((name: string) => {
  const pm2Name = pm2.derivePm2Name(name);
  pm2.pm2Restart(pm2Name);
  console.log(`Restarted ${pm2Name}`);
});

// ── doctor ────────────────────────────────────────────────
program.command("doctor").description("Fleet health check").action(() => {
  const procs = pm2.listRalph();
  const inputs = procs.map(p => {
    const bare = p.name.replace(/^ralph-/, "");
    let iteration = 0;
    let noProgress = 0;
    let progressPct = -1;
    let elapsedHours = 0;
    try {
      const cfg = resolveConfig(bare, p.cwd);
      const state = new StateReader(cfg.stateFile).read();
      if (state) {
        iteration = state.iteration;
        noProgress = state.noProgress ?? 0;
        elapsedHours = new StateReader("").elapsedHours(state);
      }
      const inv = new InventoryReader(cfg.inventoryFile).read();
      if (inv) {
        progressPct = new InventoryReader("").completionPercentage(inv);
      }
    } catch { /* ignore */ }
    return {
      name: p.name,
      status: p.status,
      restarts: p.restarts,
      iteration,
      noProgress,
      progressPct,
      elapsedHours,
    };
  });
  console.log(formatDoctorOutput(new Doctor().diagnose(inputs)));
});

// ── inventory ──────────────────────────────────────────────
program.command("inventory <name>").description("Show task progress").action((name: string) => {
  const procs = pm2.listRalph();
  const proc = pm2.findByName(procs, name);
  const bare = name.replace(/^ralph-/, "");
  // Try to get CWD from PM2, fallback to cwd
  const cwd = proc?.cwd ?? process.cwd();
  const cfg = resolveConfig(bare, cwd);
  const inv = new InventoryReader(cfg.inventoryFile).read();
  if (!inv) {
    throw new Error(`No inventory found at ${cfg.inventoryFile}`);
  }
  console.log(`Phase: ${inv.currentPhase}`);
  console.log(`Progress: ${new InventoryReader("").formatProgress(inv)}`);
  const counts = new InventoryReader("").countByStatus(inv);
  console.log(`Status: ${Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  for (const [phaseName, phase] of Object.entries(inv.phases)) {
    console.log(`\n${phaseName} (${phase.gate ?? phase.status ?? "open"}):`);
    for (const [taskId, task] of Object.entries(phase.tasks)) {
      const marker = task.status === "fully_works" ? "✅" : task.status === "in_progress" ? "🔄" : task.status === "tested" ? "🧪" : "⬜";
      console.log(`  ${marker} ${taskId}: ${task.description ?? task.status}${task.problem_notes ? ` — ⚠️ ${task.problem_notes}` : ""}`);
    }
  }
});

// ── inject-header ──────────────────────────────────────────
program.command("inject-header <name>").description("Inject working-dir header into _GOAL").action((name: string) => {
  const procs = pm2.listRalph();
  const proc = pm2.findByName(procs, name);
  const bare = name.replace(/^ralph-/, "");
  const cwd = proc?.cwd ?? process.cwd();
  const cfg = resolveConfig(bare, cwd);
  const goalMgr = new GoalFileManager(cfg.worktreePath);
  goalMgr.injectHeader(name, {
    worktreePath: cfg.worktreePath,
    stateDir: cfg.stateDir,
    branch: cfg.branch,
  });
  console.log(`Header injected into _GOAL file for ${name}`);
});

// ── progress ──────────────────────────────────────────────
program.command("progress [name]")
  .description("Show item-level progress from *-state.json files. Omit name for all loops.")
  .option("--history", "Show full transition history", false)
  .option("--regressions", "Show only regressions (rejected/reverted items)", false)
  .action((name: string | undefined, opts: { history: boolean; regressions: boolean }) => {
    const goalReader = new GoalStateReader();

    // Determine which CWDs to scan
    const targets: Array<{ label: string; cwd: string }> = [];
    if (name) {
      const procs = pm2.listRalph();
      const proc = pm2.findByName(procs, name);
      if (!proc) {
        targets.push({ label: name, cwd: name });
      } else {
        targets.push({ label: proc.name, cwd: proc.cwd });
      }
    } else {
      const procs = pm2.listRalph();
      for (const p of procs) {
        targets.push({ label: p.name, cwd: p.cwd });
      }
    }

    let found = false;
    for (const { label, cwd } of targets) {
      const goalStates = goalReader.discoverAll(cwd);
      if (goalStates.length === 0) continue;
      found = true;

      console.log(`\n${"═".repeat(60)}`);
      console.log(`  ${label}`);
      console.log(`${"═".repeat(60)}`);

      for (const gs of goalStates) {
        console.log(formatGoalProgress(gs));

        // Read transition log if it exists
        const logPath = gs.filePath.replace(/\.json$/, ".transitions.jsonl");
        if (existsSync(logPath)) {
          const { readFileSync } = require("fs");
          const lines = readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
          if (lines.length > 0) {
            let forward = 0, regressions = 0, newItem = 0;
            for (const line of lines) {
              try {
                const t = JSON.parse(line);
                if (t.from === "(new)") newItem++;
                else if (isRegression(t.from, t.to)) regressions++;
                else forward++;
              } catch { /* skip */ }
            }
            console.log(`  Transitions: ${lines.length} total (${forward} forward, ${regressions} regressions, ${newItem} new)`);

            if (opts.regressions && regressions > 0) {
              console.log(`\n  ⚠️ Regressions:`);
              for (const line of lines) {
                try {
                  const t = JSON.parse(line);
                  if (isRegression(t.from, t.to)) {
                    console.log(`  ${t.ts.slice(0, 19)}  ${t.itemId}: ${canonicalPhase(t.from)} → ${canonicalPhase(t.to)} ⚠️`);
                  }
                } catch { /* skip */ }
              }
            }

            if (opts.history) {
              console.log(`\n  Timeline:`);
              for (const line of lines) {
                try {
                  const t = JSON.parse(line);
                  const reg = isRegression(t.from, t.to) ? " ⚠️ REGRESSION" : "";
                  console.log(`  ${t.ts.slice(0, 19)}  ${t.itemId}: ${canonicalPhase(t.from)} → ${canonicalPhase(t.to)}${reg}`);
                } catch { /* skip */ }
              }
            }
          }
        }
      }
    }

    if (!found) {
      console.log(name ? `No *-state.json files found under ${name}` : "No *-state.json files found in any running loop.");
    }
  });

program.parse();
