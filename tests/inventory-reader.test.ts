import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { InventoryReader } from "../src/readers/inventory-reader";
import type { Inventory } from "../src/schemas/inventory";

describe("InventoryReader", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ralph-admin-test-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("reads complete inventory", () => {
    const invFile = join(tmp, "inventory.json");
    writeFileSync(invFile, JSON.stringify({
      lastUpdated: "2026-06-04T08:00:00Z",
      currentPhase: "P3-complete",
      phases: {
        P0: { gate: "PASSED", tasks: { "P0-T1": { status: "fully_works" }, "P0-T2": { status: "fully_works" } } },
        P1: { gate: "PASSED", tasks: { "P1-T1": { status: "fully_works" }, "P1-T2": { status: "fully_works" } } },
      },
    }));
    const reader = new InventoryReader(invFile);
    const inv = reader.read()!;
    expect(inv.currentPhase).toBe("P3-complete");
    expect(Object.keys(inv.phases)).toHaveLength(2);
  });

  test("reads partial inventory", () => {
    const invFile = join(tmp, "inventory.json");
    writeFileSync(invFile, JSON.stringify({
      lastUpdated: "2026-06-04T08:00:00Z",
      currentPhase: "P1",
      phases: {
        P0: { tasks: { "P0-T1": { status: "fully_works" } } },
        P1: { tasks: { "P1-T1": { status: "fully_works" }, "P1-T2": { status: "in_progress" }, "P1-T3": { status: "pending" } } },
      },
    }));
    const reader = new InventoryReader(invFile);
    const inv = reader.read()!;
    expect(reader.completionPercentage(inv)).toBeCloseTo(50); // 2/4 fully_works
  });

  test("returns null for missing file", () => {
    const reader = new InventoryReader(join(tmp, "nonexistent.json"));
    expect(reader.read()).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    const invFile = join(tmp, "inventory.json");
    writeFileSync(invFile, "NOT JSON {{{");
    const reader = new InventoryReader(invFile);
    expect(reader.read()).toBeNull();
  });

  test("completionPercentage is 100 for all done", () => {
    const reader = new InventoryReader("");
    const inv: Inventory = {
      lastUpdated: "", currentPhase: "P0",
      phases: { P0: { tasks: { "T1": { status: "fully_works" }, "T2": { status: "fully_works" } } } },
    };
    expect(reader.completionPercentage(inv)).toBe(100);
  });

  test("completionPercentage is 0 for all pending", () => {
    const reader = new InventoryReader("");
    const inv: Inventory = {
      lastUpdated: "", currentPhase: "P0",
      phases: { P0: { tasks: { "T1": { status: "pending" }, "T2": { status: "pending" } } } },
    };
    expect(reader.completionPercentage(inv)).toBe(0);
  });

  test("countByStatus groups correctly", () => {
    const reader = new InventoryReader("");
    const inv: Inventory = {
      lastUpdated: "", currentPhase: "P1",
      phases: {
        P0: { tasks: { "T1": { status: "fully_works" } } },
        P1: { tasks: { "T2": { status: "in_progress" }, "T3": { status: "pending" }, "T4": { status: "fully_works" } } },
      },
    };
    const counts = reader.countByStatus(inv);
    expect(counts.fully_works).toBe(2);
    expect(counts.in_progress).toBe(1);
    expect(counts.pending).toBe(1);
  });

  test("formatProgress returns compact string", () => {
    const reader = new InventoryReader("");
    const inv: Inventory = {
      lastUpdated: "", currentPhase: "P0",
      phases: { P0: { tasks: { "T1": { status: "fully_works" }, "T2": { status: "pending" } } } },
    };
    const progress = reader.formatProgress(inv);
    expect(progress).toContain("50%"); // 1/2 = 50%
    expect(progress).toMatch(/1\/2/);
  });
});
