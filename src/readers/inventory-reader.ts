import { readFileSync, existsSync } from "fs";
import type { Inventory, TaskStatus } from "../schemas/inventory";

export class InventoryReader {
  constructor(private readonly filePath: string) {}

  /** Read and parse inventory file. Returns null if missing or malformed. */
  read(): Inventory | null {
    if (!existsSync(this.filePath)) return null;
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as Inventory;
    } catch {
      return null;
    }
  }

  /** Compute completion percentage (0–100) based on fully_works / total. */
  completionPercentage(inv: Inventory): number {
    let total = 0;
    let done = 0;
    for (const phase of Object.values(inv.phases)) {
      for (const task of Object.values(phase.tasks)) {
        total++;
        if (task.status === "fully_works") done++;
      }
    }
    if (total === 0) return 0;
    return Math.round((done / total) * 1000) / 10; // one decimal
  }

  /** Count tasks grouped by status across all phases. */
  countByStatus(inv: Inventory): Record<TaskStatus, number> {
    const counts: Record<TaskStatus, number> = { pending: 0, in_progress: 0, tested: 0, fully_works: 0 };
    for (const phase of Object.values(inv.phases)) {
      for (const task of Object.values(phase.tasks)) {
        counts[task.status]++;
      }
    }
    return counts;
  }

  /** Format progress as compact string: "50% (2/4)" */
  formatProgress(inv: Inventory): string {
    let total = 0;
    let done = 0;
    for (const phase of Object.values(inv.phases)) {
      for (const task of Object.values(phase.tasks)) {
        total++;
        if (task.status === "fully_works") done++;
      }
    }
    if (total === 0) return "N/A";
    const pct = Math.round((done / total) * 100);
    return `${pct}% (${done}/${total})`;
  }
}
