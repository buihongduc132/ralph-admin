import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { GoalStateReader } from "../src/readers/goal-state-reader";

const TMP = join(import.meta.dir, "__goal_state_tmp__");

describe("GoalStateReader", () => {
  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  });

  test("discovers fix-state.json under flow/plans/", () => {
    const plansDir = join(TMP, "flow", "plans", "e2e-bugs");
    mkdirSync(plansDir, { recursive: true });
    writeFileSync(join(plansDir, "fix-state.json"), JSON.stringify({
      created: "2026-06-05",
      last_iteration: 3,
      bugs: [
        { id: "BUG-001", file: "a.ts", description: "crash on null", severity: "high", status: "verified", fixed_in_iteration: 1 },
        { id: "BUG-002", file: "b.ts", description: "missing import", severity: "medium", status: "todo", fixed_in_iteration: null },
      ],
    }));

    const reader = new GoalStateReader();
    const results = reader.discoverAll(TMP);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("fix");
    expect(results[0].kind).toBe("bugs");
    expect(results[0].items.length).toBe(2);
    expect(results[0].items[0].id).toBe("BUG-001");
    expect(results[0].items[0].phase).toBe("DONE");
    expect(results[0].items[1].phase).toBe("TODO");
    expect(results[0].lastIteration).toBe(3);
  });

  test("discovers wire-state.json under flow/plans/", () => {
    const plansDir = join(TMP, "flow", "plans", "wire-sprint1");
    mkdirSync(plansDir, { recursive: true });
    writeFileSync(join(plansDir, "wire-state.json"), JSON.stringify({
      goal: "wire-sprint1",
      created: "2026-06-05",
      items: [
        { id: "W-01", priority: "P0", title: "Fix mock types", status: "verified", files: ["a.ts"], evidence: "types exist" },
        { id: "W-02", priority: "P0", title: "Wire pipeline", status: "wired", files: ["b.ts"], evidence: "imported at line 3" },
        { id: "W-03", priority: "P1", title: "Mount receipt upload", status: "todo", files: ["c.ts"] },
        { id: "W-04", priority: "P1", title: "Wire auth", status: "deferred", files: ["d.ts"] },
      ],
    }));

    const reader = new GoalStateReader();
    const results = reader.discoverAll(TMP);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("wire");
    expect(results[0].kind).toBe("items");
    expect(results[0].items.length).toBe(4);
    // verified + wired = DONE
    expect(results[0].items[0].phase).toBe("DONE");
    expect(results[0].items[1].phase).toBe("DONE");
    expect(results[0].items[2].phase).toBe("TODO");
    expect(results[0].items[3].phase).toBe("DEFERRED");
  });

  test("discovers multiple state files in nested dirs", () => {
    const dir1 = join(TMP, "flow", "plans", "alpha");
    const dir2 = join(TMP, "flow", "plans", "beta", "sub");
    mkdirSync(dir1, { recursive: true });
    mkdirSync(dir2, { recursive: true });
    writeFileSync(join(dir1, "fix-state.json"), JSON.stringify({ bugs: [] }));
    writeFileSync(join(dir2, "wire-state.json"), JSON.stringify({ items: [] }));

    const reader = new GoalStateReader();
    const results = reader.discoverAll(TMP);
    expect(results.length).toBe(2);
  });

  test("returns empty when no flow/plans/ dir", () => {
    const reader = new GoalStateReader();
    const results = reader.discoverAll(TMP);
    expect(results.length).toBe(0);
  });

  test("snapshot builds itemId→status map", () => {
    const reader = new GoalStateReader();
    const stateFile = {
      filePath: "/tmp/test-state.json",
      name: "test",
      kind: "items" as const,
      items: [
        { id: "A", title: "a", status: "todo", phase: "TODO" },
        { id: "B", title: "b", status: "wip", phase: "WIP" },
        { id: "C", title: "c", status: "verified", phase: "DONE" },
      ],
    };
    const snap = reader.snapshot(stateFile);
    expect(snap.get("A")).toBe("todo");
    expect(snap.get("B")).toBe("wip");
    expect(snap.get("C")).toBe("verified");
    expect(snap.size).toBe(3);
  });

  test("handles in_progress status as WIP phase", () => {
    const dir = join(TMP, "flow", "plans", "x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "test-state.json"), JSON.stringify({
      items: [
        { id: "T-01", title: "active work", status: "in_progress" },
      ],
    }));

    const reader = new GoalStateReader();
    const results = reader.discoverAll(TMP);
    expect(results[0].items[0].phase).toBe("WIP");
  });
});
