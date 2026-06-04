import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { StateReader } from "../src/readers/state-reader";
import type { RalphState } from "../src/schemas/ralph-state";

describe("StateReader", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ralph-admin-test-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("reads healthy state file", () => {
    const stateFile = join(tmp, "ralph-loop.state.json");
    writeFileSync(stateFile, JSON.stringify({
      active: true, iteration: 39, minIterations: 999, maxIterations: 999,
      model: "bhd-litellm/role-smart", pid: 523645, startedAt: "2026-06-04T04:00:00Z", noProgress: 0,
    }));
    const reader = new StateReader(stateFile);
    const state = reader.read()!;
    expect(state.active).toBe(true);
    expect(state.iteration).toBe(39);
    expect(state.model).toBe("bhd-litellm/role-smart");
    expect(state.noProgress).toBe(0);
  });

  test("reads crash-loop state", () => {
    const stateFile = join(tmp, "ralph-loop.state.json");
    writeFileSync(stateFile, JSON.stringify({
      active: true, iteration: 1, minIterations: 999, maxIterations: 999,
      model: "bhd-litellm/role-smart", pid: 2002699, startedAt: "2026-06-04T04:00:00Z", noProgress: 5907,
    }));
    const reader = new StateReader(stateFile);
    const state = reader.read()!;
    expect(state.noProgress).toBe(5907);
  });

  test("returns null for missing file", () => {
    const reader = new StateReader(join(tmp, "nonexistent.json"));
    expect(reader.read()).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    const stateFile = join(tmp, "ralph-loop.state.json");
    writeFileSync(stateFile, "NOT JSON {{{");
    const reader = new StateReader(stateFile);
    expect(reader.read()).toBeNull();
  });

  test("elapsedHours computes hours since startedAt", () => {
    const reader = new StateReader("");
    const startedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    const state = { active: true, iteration: 1, minIterations: 1, maxIterations: 1, model: "x", startedAt } as RalphState;
    const hours = reader.elapsedHours(state);
    expect(hours).toBeGreaterThanOrEqual(2.9);
    expect(hours).toBeLessThanOrEqual(3.1);
  });

  test("elapsedHours returns 0 for future date", () => {
    const reader = new StateReader("");
    const state = { active: true, iteration: 1, minIterations: 1, maxIterations: 1, model: "x", startedAt: new Date(Date.now() + 86400000).toISOString() } as RalphState;
    expect(reader.elapsedHours(state)).toBe(0);
  });
});
