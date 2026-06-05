#!/usr/bin/env bun
/**
 * ralph-admin-watchd — File watcher daemon for ralph-admin.
 *
 * Watches one or more project directories for changes to *-state.json files
 * under flow/plans/. On any write, automatically:
 *   1. Reads the new state
 *   2. Diffs against last snapshot
 *   3. Appends transitions to .transitions.jsonl
 *
 * Usage:
 *   ralph-admin-watchd /path/to/project [/path/to/another ...]
 *
 * Run as PM2 process alongside ralph loops:
 *   pm2 start ralph-admin-watchd --name ralph-watchd -- /path/to/project
 */
import { watch, existsSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { GoalStateReader } from "./readers/goal-state-reader";
import type { GoalStateFile, Transition } from "./schemas/goal-state";
import { canonicalPhase, isRegression } from "./schemas/goal-state";

const reader = new GoalStateReader();

/** Persisted snapshot: map of stateFilePath → { itemId → status } */
interface SnapshotStore {
  [stateFilePath: string]: Record<string, string>;
}

class TransitionLogger {
  private snapshots: Map<string, Map<string, string>> = new Map();

  constructor(private readonly snapshotFile: string) {
    this.loadSnapshots();
  }

  /** Load last known snapshots from disk. */
  private loadSnapshots(): void {
    if (!existsSync(this.snapshotFile)) return;
    try {
      const raw = JSON.parse(require("fs").readFileSync(this.snapshotFile, "utf-8")) as SnapshotStore;
      for (const [path, obj] of Object.entries(raw)) {
        this.snapshots.set(path, new Map(Object.entries(obj)));
      }
    } catch { /* ignore corrupted */ }
  }

  /** Save current snapshots to disk. */
  private persistSnapshots(): void {
    const store: SnapshotStore = {};
    for (const [path, snap] of this.snapshots) {
      store[path] = Object.fromEntries(snap);
    }
    mkdirSync(dirname(this.snapshotFile), { recursive: true });
    require("fs").writeFileSync(this.snapshotFile, JSON.stringify(store, null, 2), "utf-8");
  }

  /** Record transitions for a state file. Returns new transitions. */
  record(stateFile: GoalStateFile): Transition[] {
    const last = this.snapshots.get(stateFile.filePath) ?? new Map();
    const current = new Map<string, string>();
    for (const item of stateFile.items) {
      current.set(item.id, item.status);
    }

    const now = new Date().toISOString();
    const transitions: Transition[] = [];

    for (const [id, status] of current) {
      const prev = last.get(id);
      if (prev === undefined) {
        transitions.push({ ts: now, itemId: id, from: "(new)", to: status });
      } else if (prev !== status) {
        transitions.push({ ts: now, itemId: id, from: prev, to: status });
      }
    }

    for (const [id, prev] of last) {
      if (!current.has(id)) {
        transitions.push({ ts: now, itemId: id, from: prev, to: "(removed)" });
      }
    }

    if (transitions.length > 0) {
      this.appendLog(stateFile.filePath, transitions);
      this.snapshots.set(stateFile.filePath, current);
      this.persistSnapshots();
    }

    return transitions;
  }

  /** Append transitions to the companion .transitions.jsonl file. */
  private appendLog(stateFilePath: string, transitions: Transition[]): void {
    const logPath = stateFilePath.replace(/\.json$/, ".transitions.jsonl");
    const lines = transitions.map(t => JSON.stringify(t)).join("\n") + "\n";
    mkdirSync(dirname(logPath), { recursive: true });
    require("fs").writeFileSync(logPath, lines, { flag: "a", encoding: "utf-8" });
  }
}

// ── Main ──────────────────────────────────────────────────

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("Usage: ralph-admin-watchd <project-dir> [...more-dirs]");
  process.exit(1);
}

const snapshotFile = join(dirs[0], ".ralph-admin-watchd-snapshots.json");
const logger = new TransitionLogger(snapshotFile);

// Initial scan — record current state of all discovered files
for (const dir of dirs) {
  const stateFiles = reader.discoverAll(dir);
  for (const sf of stateFiles) {
    const transitions = logger.record(sf);
    if (transitions.length > 0) {
      const regressions = transitions.filter(t => isRegression(t.from, t.to));
      console.log(`[${new Date().toISOString()}] ${sf.name}: ${transitions.length} initial items${regressions.length > 0 ? ` (${regressions.length} regressions)` : ""}`);
    }
  }
}

// Watch each project's flow/plans/ directory
for (const dir of dirs) {
  const plansDir = join(dir, "flow", "plans");
  if (!existsSync(plansDir)) {
    console.log(`No flow/plans/ in ${dir}, skipping watch`);
    continue;
  }

  console.log(`Watching ${plansDir} for *-state.json changes`);

  try {
    const watcher = watch(plansDir, { recursive: true }, (event, filename) => {
      if (!filename || !filename.endsWith("-state.json")) return;

      const fullPath = join(plansDir, filename);
      if (!existsSync(fullPath)) return;

      // Small debounce — editors write in multiple chunks
      setTimeout(() => {
        const sf = reader.readStateFile(fullPath);
        if (!sf) return;

        const transitions = logger.record(sf);
        if (transitions.length > 0) {
          const regressions = transitions.filter(t => isRegression(t.from, t.to));
          for (const t of transitions) {
            const reg = isRegression(t.from, t.to) ? " ⚠️ REGRESSION" : "";
            console.log(`[${new Date().toISOString()}] ${sf.name}/${t.itemId}: ${canonicalPhase(t.from)} → ${canonicalPhase(t.to)}${reg}`);
          }
        }
      }, 500);
    });

    process.on("SIGINT", () => {
      watcher.close();
      process.exit(0);
    });
  } catch (e) {
    console.error(`Failed to watch ${plansDir}:`, e);
  }
}

console.log(`ralph-admin-watchd running (snapshot: ${snapshotFile})`);

// Keep alive
setInterval(() => {}, 60000);
