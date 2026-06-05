import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { Transition, GoalStateFile } from "./schemas/goal-state";
import { isRegression, canonicalPhase } from "./schemas/goal-state";

/**
 * Tracks status transitions for items across goal state files.
 *
 * Storage: a companion JSONL file next to each *-state.json:
 *   fix-state.json → fix-state.transitions.jsonl
 *
 * Each line: {"ts":"...","itemId":"BUG-001","from":"todo","to":"fixed"}
 *
 * On each `record()` call, reads current state, compares with last snapshot,
 * appends any diffs as transitions.
 */
export class TransitionTracker {
  /**
   * Record transitions by comparing current state against last snapshot.
   * Returns the list of NEW transitions detected.
   */
  record(stateFile: GoalStateFile): Transition[] {
    const logPath = this.logPath(stateFile.filePath);
    const lastSnapshot = this.readLastSnapshot(logPath);
    const currentSnapshot = new Map<string, string>();
    for (const item of stateFile.items) {
      currentSnapshot.set(item.id, item.status);
    }

    const newTransitions: Transition[] = [];
    const now = new Date().toISOString();

    // Detect changes and new items
    for (const [id, status] of currentSnapshot) {
      const prev = lastSnapshot.get(id);
      if (prev === undefined) {
        // New item — record its initial status
        newTransitions.push({ ts: now, itemId: id, from: "(new)", to: status });
      } else if (prev !== status) {
        newTransitions.push({ ts: now, itemId: id, from: prev, to: status });
      }
    }

    // Detect removed items (status went to something no longer present)
    for (const [id, prev] of lastSnapshot) {
      if (!currentSnapshot.has(id)) {
        newTransitions.push({ ts: now, itemId: id, from: prev, to: "(removed)" });
      }
    }

    // Append new transitions
    if (newTransitions.length > 0) {
      this.appendTransitions(logPath, newTransitions);
    }

    // Update snapshot
    this.writeSnapshot(logPath, currentSnapshot);

    return newTransitions;
  }

  /**
   * Read all recorded transitions for a state file.
   */
  readHistory(stateFilePath: string): Transition[] {
    const logPath = this.logPath(stateFilePath);
    if (!existsSync(logPath)) return [];
    try {
      const lines = readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
      const transitions: Transition[] = [];
      for (const line of lines) {
        // Skip snapshot line (starts with #)
        if (line.startsWith("#")) continue;
        try {
          transitions.push(JSON.parse(line) as Transition);
        } catch { /* skip malformed */ }
      }
      return transitions;
    } catch {
      return [];
    }
  }

  /**
   * Find all regressions (items that went backward in the lifecycle).
   */
  findRegressions(stateFilePath: string): Transition[] {
    return this.readHistory(stateFilePath).filter(t => isRegression(t.from, t.to));
  }

  /**
   * Build a timeline for a specific item — all its transitions in order.
   */
  itemTimeline(stateFilePath: string, itemId: string): Transition[] {
    return this.readHistory(stateFilePath).filter(t => t.itemId === itemId);
  }

  /**
   * Summary: count transitions by type (forward, regression, new).
   */
  summarize(stateFilePath: string): { total: number; regressions: number; forward: number; newItem: number } {
    const history = this.readHistory(stateFilePath);
    let regressions = 0;
    let forward = 0;
    let newItem = 0;
    for (const t of history) {
      if (t.from === "(new)") { newItem++; continue; }
      if (t.to === "(removed)") continue;
      if (isRegression(t.from, t.to)) regressions++;
      else forward++;
    }
    return { total: history.length, regressions, forward, newItem };
  }

  /**
   * Format a transition log as human-readable timeline.
   */
  formatTimeline(transitions: Transition[]): string {
    if (transitions.length === 0) return "(no transitions recorded)";
    return transitions.map(t => {
      const regression = isRegression(t.from, t.to) ? " ⚠️ REGRESSION" : "";
      const fromPhase = canonicalPhase(t.from);
      const toPhase = canonicalPhase(t.to);
      return `${t.ts.slice(0, 19)}  ${t.itemId}: ${fromPhase} → ${toPhase}${regression}`;
    }).join("\n");
  }

  // ── Private ──────────────────────────────────────────────

  /** Derive the companion log path: foo-state.json → foo-state.transitions.jsonl */
  logPath(stateFilePath: string): string {
    return stateFilePath.replace(/\.json$/, ".transitions.jsonl");
  }

  /** Read the last snapshot from the log file (last line starting with #). */
  private readLastSnapshot(logPath: string): Map<string, string> {
    if (!existsSync(logPath)) return new Map();
    try {
      const content = readFileSync(logPath, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      // Find last snapshot line
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith("#")) {
          try {
            const data = JSON.parse(lines[i].slice(1)) as Record<string, string>;
            return new Map(Object.entries(data));
          } catch { /* ignore */ }
        }
      }
      return new Map();
    } catch {
      return new Map();
    }
  }

  /** Write snapshot as a comment line at end of log. */
  private writeSnapshot(logPath: string, snapshot: Map<string, string>): void {
    const dir = dirname(logPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Rewrite: all transition lines + new snapshot
    let existing = "";
    if (existsSync(logPath)) {
      const lines = readFileSync(logPath, "utf-8").split("\n").filter(l => !l.startsWith("#"));
      existing = lines.join("\n");
    }
    const snapshotLine = `#${JSON.stringify(Object.fromEntries(snapshot))}`;
    const content = existing ? `${existing}\n${snapshotLine}\n` : `${snapshotLine}\n`;
    writeFileSync(logPath, content, "utf-8");
  }

  /** Append new transition lines to the log. */
  private appendTransitions(logPath: string, transitions: Transition[]): void {
    const dir = dirname(logPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const lines = transitions.map(t => JSON.stringify(t)).join("\n") + "\n";
    writeFileSync(logPath, lines, { flag: "a", encoding: "utf-8" });
  }
}
