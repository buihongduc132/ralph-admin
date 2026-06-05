import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import type { TrackedItem, GoalStateFile } from "../schemas/goal-state";
import { canonicalPhase } from "../schemas/goal-state";

/**
 * Discovers and reads custom goal state files (*-state.json) under a project's
 * flow/plans/ directory. Handles two known variants:
 *   - Bug state files: { bugs: [{id, status, …}] }
 *   - Wire/task state files: { items: [{id, status, …}] }
 */
export class GoalStateReader {
  /**
   * Discover all *-state.json files under `flow/plans/` in the given root.
   * Returns one GoalStateFile per discovered file.
   */
  discoverAll(rootDir: string): GoalStateFile[] {
    const plansDir = join(rootDir, "flow", "plans");
    if (!existsSync(plansDir)) return [];

    const results: GoalStateFile[] = [];

    const scan = (dir: string) => {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scan(join(dir, entry.name));
        } else if (entry.name.endsWith("-state.json")) {
          const filePath = join(dir, entry.name);
          const parsed = this.readStateFile(filePath);
          if (parsed) results.push(parsed);
        }
      }
    };

    scan(plansDir);
    return results;
  }

  /**
   * Read and normalize a single *-state.json file.
   */
  readStateFile(filePath: string): GoalStateFile | null {
    if (!existsSync(filePath)) return null;
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf-8"));
      return this.normalize(filePath, raw);
    } catch {
      return null;
    }
  }

  /**
   * Normalize raw JSON into GoalStateFile, handling both bug and wire schemas.
   */
  normalize(filePath: string, raw: Record<string, unknown>): GoalStateFile {
    const fileName = basename(filePath, ".json"); // e.g., "fix-state"
    const shortName = fileName.replace(/-state$/, ""); // e.g., "fix"

    // Determine kind and extract items
    let items: TrackedItem[] = [];
    let kind: GoalStateFile["kind"] = "unknown";
    let created: string | undefined;
    let lastIteration: number | undefined;

    if (Array.isArray(raw.bugs)) {
      kind = "bugs";
      items = (raw.bugs as Record<string, unknown>[]).map(bug => ({
        id: String(bug.id ?? ""),
        title: String(bug.description ?? "").slice(0, 80),
        status: String(bug.status ?? "todo"),
        phase: canonicalPhase(String(bug.status ?? "todo")),
        priority: String(bug.severity ?? ""),
        files: bug.file ? [String(bug.file)] : undefined,
        evidence: bug.evidence ? String(bug.evidence) : undefined,
        notes: undefined,
        commit: undefined,
      }));
      created = raw.created ? String(raw.created) : undefined;
      lastIteration = typeof raw.last_iteration === "number" ? raw.last_iteration : undefined;
    } else if (Array.isArray(raw.items)) {
      kind = "items";
      items = (raw.items as Record<string, unknown>[]).map(item => ({
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        status: String(item.status ?? "todo"),
        phase: canonicalPhase(String(item.status ?? "todo")),
        priority: String(item.priority ?? ""),
        files: Array.isArray(item.files) ? (item.files as string[]) : undefined,
        evidence: item.evidence ? String(item.evidence) : undefined,
        notes: item.notes ? String(item.notes) : undefined,
        commit: item.commit ? String(item.commit) : undefined,
      }));
      created = raw.created ? String(raw.created) : undefined;
      lastIteration = typeof raw.last_iteration === "number" ? raw.last_iteration : undefined;
    }

    return { filePath, name: shortName, kind, items, created, lastIteration };
  }

  /**
   * Build a snapshot: map of itemId → status for transition tracking.
   */
  snapshot(stateFile: GoalStateFile): Map<string, string> {
    const map = new Map<string, string>();
    for (const item of stateFile.items) {
      map.set(item.id, item.status);
    }
    return map;
  }
}
