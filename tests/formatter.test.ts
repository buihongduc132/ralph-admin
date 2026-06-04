import { describe, test, expect } from "bun:test";
import { formatListTable, formatDoctorOutput, formatUptime, pad } from "../src/formatter";
import type { DiagnosisResult } from "../src/doctor";

describe("Formatter", () => {
  test("pad pads string to width", () => {
    expect(pad("hi", 5)).toBe("hi   ");
  });

  test("pad does not truncate", () => {
    expect(pad("hello world", 5)).toBe("hello world");
  });

  test("formatUptime formats milliseconds to hours", () => {
    expect(formatUptime(3 * 60 * 60 * 1000)).toBe("3.0h");
  });

  test("formatUptime formats < 1 hour as minutes", () => {
    expect(formatUptime(30 * 60 * 1000)).toBe("30m");
  });

  test("formatListTable produces aligned columns", () => {
    const rows = [
      { name: "ralph-test", status: "online", iteration: 39, model: "role-smart", progress: "100% (2/2)", uptime: "7.0h", restarts: 0 },
      { name: "ralph-long-name-test", status: "stopped", iteration: 1, model: "big-model", progress: "0%", uptime: "5m", restarts: 500 },
    ];
    const table = formatListTable(rows);
    expect(table).toContain("ralph-test");
    expect(table).toContain("ralph-long-name-test");
    expect(table).toContain("online");
    expect(table).toContain("stopped");
    // Header present
    expect(table).toContain("NAME");
    expect(table).toContain("STATUS");
  });

  test("formatListTable handles empty list", () => {
    const table = formatListTable([]);
    expect(table).toContain("No ralph loops");
  });

  test("formatDoctorOutput formats crash-looping", () => {
    const diagnosis: DiagnosisResult = {
      crashLooping: [{ name: "ralph-crash", reason: "500 restarts in 1h" }],
      completedRunning: [],
      stuck: [],
      healthy: [{ name: "ralph-ok", reason: "45 iterations, 0 restarts" }],
      stopped: [],
    };
    const output = formatDoctorOutput(diagnosis);
    expect(output).toContain("CRASH-LOOPING");
    expect(output).toContain("ralph-crash");
    expect(output).toContain("500 restarts in 1h");
    expect(output).toContain("HEALTHY");
    expect(output).toContain("ralph-ok");
  });

  test("formatDoctorOutput shows all categories", () => {
    const diagnosis: DiagnosisResult = {
      crashLooping: [{ name: "c1", reason: "r" }],
      completedRunning: [{ name: "d1", reason: "r" }],
      stuck: [{ name: "s1", reason: "r" }],
      healthy: [{ name: "h1", reason: "r" }],
      stopped: [{ name: "p1", reason: "r" }],
    };
    const output = formatDoctorOutput(diagnosis);
    expect(output).toContain("CRASH-LOOPING");
    expect(output).toContain("COMPLETED-RUNNING");
    expect(output).toContain("STUCK");
    expect(output).toContain("HEALTHY");
    expect(output).toContain("STOPPED");
  });
});
