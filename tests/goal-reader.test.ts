import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { GoalFileManager } from "../src/readers/goal-reader";

describe("GoalFileManager", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ralph-admin-test-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("finds _GOAL file in directory", () => {
    writeFileSync(join(tmp, "_GOAL_my-feature.md"), "# My Goal\nSome content");
    const mgr = new GoalFileManager(tmp);
    const found = mgr.findGoalFile();
    expect(found).toBeTruthy();
    expect(found).toContain("_GOAL_my-feature.md");
  });

  test("returns null when no _GOAL file", () => {
    writeFileSync(join(tmp, "other.md"), "nope");
    const mgr = new GoalFileManager(tmp);
    expect(mgr.findGoalFile()).toBeNull();
  });

  test("injects header into _GOAL file", () => {
    const goalFile = join(tmp, "_GOAL_test.md");
    writeFileSync(goalFile, "# _GOAL Test\n\nSome content");
    const mgr = new GoalFileManager(tmp);
    mgr.injectHeader("test-loop", {
      worktreePath: "/home/user/project-wt-test-loop",
      stateDir: "/home/user/project-wt-test-loop/.ralph-test-loop",
      branch: "wt/test-loop",
    });
    const content = readFileSync(goalFile, "utf-8");
    expect(content).toContain("<!-- ralph-admin:working-dir-header -->");
    expect(content).toContain("/home/user/project-wt-test-loop");
    expect(content).toContain("wt/test-loop");
    // Original content preserved
    expect(content).toContain("# _GOAL Test");
  });

  test("injection is idempotent — skip if already present", () => {
    const goalFile = join(tmp, "_GOAL_test.md");
    writeFileSync(goalFile, "# _GOAL Test\n\nSome content");
    const mgr = new GoalFileManager(tmp);
    mgr.injectHeader("test-loop", {
      worktreePath: "/path/one",
      stateDir: "/path/one/.ralph-test-loop",
      branch: "wt/test-loop",
    });
    const first = readFileSync(goalFile, "utf-8");
    // Inject again with different paths
    mgr.injectHeader("test-loop", {
      worktreePath: "/path/two",
      stateDir: "/path/two/.ralph-test-loop",
      branch: "wt/test-loop",
    });
    const second = readFileSync(goalFile, "utf-8");
    // Should NOT have changed — idempotent
    expect(first).toBe(second);
    expect(second).not.toContain("/path/two");
  });
});
