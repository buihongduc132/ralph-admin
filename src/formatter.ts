import type { DiagnosisResult } from "./doctor";

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
