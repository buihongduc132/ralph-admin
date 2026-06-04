import { readFileSync, existsSync } from "fs";
import type { RalphState } from "../schemas/ralph-state";

export class StateReader {
  constructor(private readonly filePath: string) {}

  /** Read and parse the state file. Returns null if missing or malformed. */
  read(): RalphState | null {
    if (!existsSync(this.filePath)) return null;
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as RalphState;
    } catch {
      return null;
    }
  }

  /** Compute elapsed hours since startedAt. Returns 0 if future or invalid. */
  elapsedHours(state: RalphState): number {
    const start = new Date(state.startedAt).getTime();
    const now = Date.now();
    const diff = now - start;
    return diff > 0 ? diff / (1000 * 60 * 60) : 0;
  }
}
