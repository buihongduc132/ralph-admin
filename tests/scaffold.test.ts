import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { ScaffoldBuilder } from "../src/scaffold";

describe("ScaffoldBuilder", () => {
  let tmp: string;
  let builder: ScaffoldBuilder;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ralph-admin-test-"));
    builder = new ScaffoldBuilder();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("scaffoldStateDir creates state dir with all files", () => {
    const stateDir = join(tmp, ".ralph-test-loop");
    const { created, skipped } = builder.scaffoldStateDir(stateDir, "test-loop");
    expect(existsSync(stateDir)).toBe(true);
    expect(existsSync(join(stateDir, "rules.toml"))).toBe(true);
    expect(existsSync(join(stateDir, "inventory.json"))).toBe(true);
    expect(created.length).toBeGreaterThanOrEqual(2);
    expect(skipped.length).toBe(0);
  });

  test("scaffoldStateDir writes valid rules.toml", () => {
    const stateDir = join(tmp, ".ralph-test-loop");
    builder.scaffoldStateDir(stateDir, "test-loop");
    const rules = readFileSync(join(stateDir, "rules.toml"), "utf-8");
    expect(rules).toContain("modulo");
    expect(rules).toContain("I%5");
  });

  test("scaffoldStateDir writes valid inventory.json", () => {
    const stateDir = join(tmp, ".ralph-test-loop");
    builder.scaffoldStateDir(stateDir, "test-loop");
    const inv = JSON.parse(readFileSync(join(stateDir, "inventory.json"), "utf-8"));
    expect(inv.lastUpdated).toBeTruthy();
    expect(inv.currentPhase).toBe("P0");
    expect(inv.phases).toBeDefined();
  });

  test("scaffoldStateDir is idempotent — skips existing files", () => {
    const stateDir = join(tmp, ".ralph-test-loop");
    const first = builder.scaffoldStateDir(stateDir, "test-loop");
    const second = builder.scaffoldStateDir(stateDir, "test-loop");
    expect(first.created.length).toBeGreaterThan(0);
    expect(second.skipped.length).toBeGreaterThan(0);
    expect(second.created.length).toBe(0);
  });

  test("buildStartCommand constructs correct command", () => {
    const cmd = builder.buildStartCommand({
      name: "my-feature",
      worktreePath: "/home/user/project-wt-my-feature",
      stateDirName: ".ralph-my-feature",
      goalFile: "/home/user/project-wt-my-feature/_GOAL_my-feature.md",
      model: "bhd-litellm/role-smart",
      reuseState: false,
    });
    expect(cmd).toContain("my-feature");
    expect(cmd).toContain(".ralph-my-feature");
    expect(cmd).toContain("bhd-litellm/role-smart");
    expect(cmd).toContain("_GOAL_my-feature.md");
  });

  test("buildStartCommand with --reuse-state flag", () => {
    const cmd = builder.buildStartCommand({
      name: "test",
      worktreePath: "/tmp/w",
      stateDirName: ".ralph-test",
      goalFile: "/tmp/w/_GOAL.md",
      model: "default",
      reuseState: true,
    });
    expect(cmd).toContain("--reuse-state");
  });
});
