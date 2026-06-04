import { describe, test, expect } from "bun:test";
import { LoopConfig, resolveConfig } from "../src/config";

describe("resolveConfig", () => {
  test("resolves convention from name", () => {
    const c = resolveConfig("my-feature", "/home/user/project");
    expect(c.pm2Name).toBe("ralph-my-feature");
    expect(c.stateDirName).toBe(".ralph-my-feature");
    expect(c.stateFile).toContain(".ralph-my-feature/ralph-loop.state.json");
    expect(c.branch).toBe("wt/my-feature");
  });

  test("accepts explicit overrides", () => {
    const c = resolveConfig("custom", "/home/user/project", {
      stateDir: "/tmp/s",
      worktree: "/tmp/w",
      goalFile: "/tmp/G.md",
      branch: "feat/x",
    });
    expect(c.stateDir).toBe("/tmp/s");
    expect(c.worktreePath).toBe("/tmp/w");
    expect(c.goalFile).toBe("/tmp/G.md");
    expect(c.branch).toBe("feat/x");
  });

  test("rejects invalid names", () => {
    expect(() => resolveConfig("BAD NAME!", "/tmp")).toThrow(/Invalid loop name/);
  });

  test("rejects empty names", () => {
    expect(() => resolveConfig("", "/tmp")).toThrow(/Invalid loop name/);
  });

  test("rejects names with slashes", () => {
    expect(() => resolveConfig("foo/bar", "/tmp")).toThrow(/Invalid loop name/);
  });

  test("convention resolves inventory file path", () => {
    const c = resolveConfig("test-loop", "/home/user/project");
    expect(c.inventoryFile).toContain(".ralph-test-loop/inventory.json");
  });

  test("convention resolves rules file path", () => {
    const c = resolveConfig("test-loop", "/home/user/project");
    expect(c.rulesFile).toContain(".ralph-test-loop/rules.toml");
  });

  test("convention resolves worktree path", () => {
    const c = resolveConfig("my-feat", "/home/user/project");
    expect(c.worktreePath).toContain("project-wt-my-feat");
  });

  test("already-prefixed name stays as-is for pm2Name", () => {
    const c = resolveConfig("ralph-existing", "/home/user/project");
    expect(c.pm2Name).toBe("ralph-existing");
    expect(c.stateDirName).toBe(".ralph-existing");
  });
});
