import type { DiagnosisResult } from "./doctor";
import type { GoalStateFile, TrackedItem, Transition } from "./schemas/goal-state";
import { canonicalPhase } from "./schemas/goal-state";

/** Pad a string to the given width with spaces. Never truncates. */
export function pad(str: string, width: number): string {
  if (str.length >= width) return str;
  return str + " ".repeat(width - str.length);
}

/** Format uptime in milliseconds to human-readable string. */
export function formatUptime(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  }
  const minutes = Math.round(ms / (1000 * 60));
  return `${minutes}m`;
}

/** Format status with visual indicator. */
export function formatStatus(status: string): string {
  switch (status) {
    case "online": return "🟢 online";
    case "stopped": return "🔴 stopped";
    case "errored": return "❌ errored";
    default: return `⚪ ${status}`;
  }
}

export interface ListRow {
  name: string;
  status: string;
  iteration: number;
  model: string;
  progress: string;
  uptime: string;
  restarts: number;
}

/** Format list of processes as aligned table. */
export function formatListTable(rows: ListRow[]): string {
  if (rows.length === 0) {
    return "No ralph loops running.";
  }

  const COLS = [24, 12, 6, 22, 16, 8, 10] as const;
  const headers = ["NAME", "STATUS", "ITER", "MODEL", "PROGRESS", "UPTIME", "RESTARTS"];

  const lines: string[] = [];
  lines.push(headers.map((h, i) => pad(h, COLS[i])).join("  "));
  lines.push("-".repeat(lines[0].length));

  for (const r of rows) {
    const vals = [
      r.name,
      r.status,
      String(r.iteration),
      r.model,
      r.progress,
      r.uptime,
      String(r.restarts),
    ];
    lines.push(vals.map((v, i) => pad(v, COLS[i])).join("  "));
  }

  return lines.join("\n");
}

/** Format a single tracked item as one-line summary. */
export function formatItemRow(item: TrackedItem, width: number = 0): string {
  const marker = item.phase === "DONE" ? "✅" : item.phase === "WIP" ? "🔄" : item.phase === "REVIEW" ? "🔎" : item.phase === "REJECTED" ? "❌" : item.phase === "DEFERRED" ? "⏸️" : item.phase === "BLOCKED" ? "🚫" : "⬜";
  const pri = item.priority ? `[${item.priority}] ` : "";
  const line = `${marker} ${item.id}: ${pri}${item.title}`;
  return width > 0 && line.length > width ? line.slice(0, width - 1) + "…" : line;
}

/** Format all items from a goal state file, grouped by status phase. */
export function formatGoalProgress(stateFile: GoalStateFile): string {
  const lines: string[] = [];
  lines.push(`📁 ${stateFile.name} (${stateFile.kind}, ${stateFile.items.length} items)`);
  lines.push("");

  // Group by phase
  const groups = new Map<string, TrackedItem[]>();
  for (const item of stateFile.items) {
    const phase = item.phase;
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase)!.push(item);
  }

  const phaseOrder = ["BLOCKED", "TODO", "WIP", "REVIEW", "REJECTED", "DONE", "DEFERRED"];
  for (const phase of phaseOrder) {
    const items = groups.get(phase);
    if (!items || items.length === 0) continue;
    lines.push(`  ${phase} (${items.length}):`);
    for (const item of items) {
      lines.push(`    ${formatItemRow(item)}`);
    }
    lines.push("");
  }

  // Remaining phases not in order
  for (const [phase, items] of groups) {
    if (phaseOrder.includes(phase)) continue;
    lines.push(`  ${phase} (${items.length}):`);
    for (const item of items) {
      lines.push(`    ${formatItemRow(item)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Format transition summary for display. */
export function formatTransitionSummary(transitions: Transition[]): string {
  if (transitions.length === 0) return "  (no transitions yet)";
  const lines: string[] = [];
  for (const t of transitions) {
    const regression = ""; // caller should use isRegression
    const fromP = canonicalPhase(t.from);
    const toP = canonicalPhase(t.to);
    const arrow = t.from === "(new)" ? "appeared as" : `${fromP} →`;
    lines.push(`  ${t.itemId}: ${arrow} ${toP} (${t.ts.slice(0, 19)})`);
  }
  return lines.join("\n");
}

/** Format doctor diagnosis result for CLI output. */
export function formatDoctorOutput(result: DiagnosisResult): string {
  const sections: string[] = ["🔍 Fleet Health Check", ""];

  const categories: Array<{ label: string; icon: string; items: DiagnosisResult["crashLooping"] }> = [
    { label: "CRASH-LOOPING", icon: "🔴", items: result.crashLooping },
    { label: "COMPLETED-RUNNING", icon: "✅", items: result.completedRunning },
    { label: "STUCK", icon: "🟡", items: result.stuck },
    { label: "HEALTHY", icon: "🟢", items: result.healthy },
    { label: "STOPPED", icon: "⚪", items: result.stopped },
  ];

  for (const cat of categories) {
    if (cat.items.length === 0) continue;
    sections.push(`${cat.icon} ${cat.label} (${cat.items.length}):`);
    for (const item of cat.items) {
      sections.push(`  ${item.name}: ${item.reason}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}
