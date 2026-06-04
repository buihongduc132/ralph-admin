import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { checkStateVersion, type RalphState } from "../src/schemas/ralph-state";
import type { Inventory, TaskStatus } from "../src/schemas/inventory";
import type { RulesToml } from "../src/schemas/rules-toml";

describe("RalphState schema", () => {
  test("parses healthy fixture", () => {
    const state: RalphState = require("../tests/fixtures/state-healthy.json");
    expect(state.active).toBe(true);
    expect(state.iteration).toBe(39);
    expect(state.model).toBe("bhd-litellm/role-smart");
    expect(state.noProgress).toBe(0);
  });

  test("parses crash-loop fixture", () => {
    const state: RalphState = require("../tests/fixtures/state-crash-loop.json");
    expect(state.active).toBe(true);
    expect(state.iteration).toBe(1);
    expect(state.noProgress).toBe(5907);
  });

  test("checkStateVersion — known versions produce no warnings", () => {
    expect(checkStateVersion({ active: true, iteration: 1, minIterations: 1, maxIterations: 1, model: "x", startedAt: "" })).toEqual([]);
    expect(checkStateVersion({ version: 1, active: true, iteration: 1, minIterations: 1, maxIterations: 1, model: "x", startedAt: "" })).toEqual([]);
  });

  test("checkStateVersion — unknown version produces warning", () => {
    const warnings = checkStateVersion({ version: 99, active: true, iteration: 1, minIterations: 1, maxIterations: 1, model: "x", startedAt: "" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("99");
  });
});

describe("Inventory schema", () => {
  test("parses complete inventory", () => {
    const inv: Inventory = require("../tests/fixtures/inventory-complete.json");
    expect(inv.currentPhase).toBe("P3-complete");
    expect(Object.keys(inv.phases)).toHaveLength(2);
    const p0tasks = Object.values(inv.phases.P0.tasks);
    expect(p0tasks.every(t => t.status === "fully_works")).toBe(true);
  });

  test("parses partial inventory", () => {
    const inv: Inventory = require("../tests/fixtures/inventory-partial.json");
    expect(inv.currentPhase).toBe("P1");
    const p1tasks = Object.values(inv.phases.P1.tasks);
    const statuses = p1tasks.map(t => t.status);
    expect(statuses).toContain("fully_works");
    expect(statuses).toContain("in_progress");
    expect(statuses).toContain("pending");
    // problem_notes on in_progress task
    const inProgress = p1tasks.find(t => t.status === "in_progress")!;
    expect(inProgress.problem_notes).toBe("test flaky");
  });
});

describe("RulesToml schema", () => {
  test("parses rules fixture", async () => {
    const { parse } = await import("smol-toml");
    const tomlText = readFileSync(require.resolve("../tests/fixtures/rules-default.toml"), "utf-8");
    const parsed = parse(tomlText) as unknown as RulesToml;
    expect(parsed.rules.modulo.name).toBe("modulo");
    expect(parsed.rules.modulo.enabled).toBe(true);
    expect(parsed.rules.modulo.entries).toHaveLength(4);
    expect(parsed.rules.modulo.entries[0].at).toBe(5);
    expect(parsed.rules.modulo.entries[3].at).toBe(15);
  });
});
