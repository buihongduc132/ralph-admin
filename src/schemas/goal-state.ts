/**
 * Unified item schema for custom goal state files (*-state.json).
 *
 * Two known variants exist:
 *   fix-state.json  → bugs[] with {id, status, severity, …}
 *   wire-state.json → items[] with {id, status, priority, …}
 *
 * Both normalize to TrackedItem — the lowest common denominator.
 */

/** Normalized status — the canonical lifecycle every item follows. */
export type ItemStatus =
  | "todo"        // not started
  | "wip"         // actively being worked on
  | "in_progress" // alias for wip (used by inventory-style files)
  | "review"      // pending review / verification
  | "verified"    // reviewer confirmed
  | "fixed"       // bug fixed (synonym for verified in bug context)
  | "wired"       // component wired (synonym for verified in wire context)
  | "tested"      // tests pass (synonym for verified)
  | "deferred"    // explicitly deferred
  | "rejected"    // review rejected — needs rework
  | "blocked";    // blocked by external dependency

/** Map any raw status string to the canonical lifecycle phase. */
export function canonicalPhase(status: string): string {
  switch (status) {
    case "todo": return "TODO";
    case "wip":
    case "in_progress": return "WIP";
    case "review": return "REVIEW";
    case "verified":
    case "fixed":
    case "wired":
    case "tested":
    case "fully_works": return "DONE";
    case "rejected": return "REJECTED";
    case "deferred": return "DEFERRED";
    case "blocked": return "BLOCKED";
    default: return status.toUpperCase();
  }
}

/** Is the item in a "terminal" state (not moving forward)? */
export function isTerminal(status: string): boolean {
  return ["verified", "fixed", "wired", "tested", "fully_works", "deferred"].includes(status);
}

/** A single tracked item normalized from any *-state.json. */
export interface TrackedItem {
  id: string;
  title: string;
  status: string;
  phase: string;         // canonicalPhase(status)
  priority?: string;     // P0/P1/P2 or high/medium/low
  files?: string[];
  evidence?: string;
  notes?: string;
  commit?: string;
}

/** A goal state file discovered on disk. */
export interface GoalStateFile {
  /** Absolute path to the *-state.json file. */
  filePath: string;
  /** Short name derived from filename (e.g., "fix", "wire"). */
  name: string;
  /** Type of state file — "bugs" or "items". */
  kind: "bugs" | "items" | "unknown";
  /** All tracked items in this file. */
  items: TrackedItem[];
  /** ISO date the file was created, if known. */
  created?: string;
  /** Last iteration recorded, if known. */
  lastIteration?: number;
}

/** A single status transition event. */
export interface Transition {
  /** ISO timestamp when the transition was observed. */
  ts: string;
  /** Item ID (e.g., "BUG-001", "W-02"). */
  itemId: string;
  /** Previous status. */
  from: string;
  /** New status. */
  to: string;
}

/** Is this transition a regression? (moving backward in the lifecycle) */
export function isRegression(from: string, to: string): boolean {
  const donePhases = new Set(["DONE", "DEFERRED"]);
  const fromPhase = canonicalPhase(from);
  const toPhase = canonicalPhase(to);
  // Moving from DONE/REVIEW/DEFERRED back to WIP/TODO/REJECTED = regression
  if (donePhases.has(fromPhase) && ["WIP", "TODO", "REJECTED", "BLOCKED"].includes(toPhase)) return true;
  if (fromPhase === "REVIEW" && ["WIP", "TODO", "REJECTED"].includes(toPhase)) return true;
  return false;
}
