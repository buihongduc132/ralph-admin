import { existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

export interface ConfigOverrides {
  stateDir?: string;
  worktree?: string;
  goalFile?: string;
  branch?: string;
}

const LOOP_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

function validateName(name: string): void {
  if (!name || !LOOP_NAME_RE.test(name)) {
    throw new Error(`Invalid loop name: '${name}'. Must match ${LOOP_NAME_RE.source}`);
  }
}

export class LoopConfig {
  readonly name: string;
  readonly pm2Name: string;
  readonly stateDirName: string;
  readonly stateDir: string;
  readonly stateFile: string;
  readonly inventoryFile: string;
  readonly rulesFile: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly goalFile: string | null;

  constructor(
    name: string,
    sourceRepo: string,
    overrides: ConfigOverrides = {},
  ) {
    validateName(name);
    this.name = name;
    // If name already starts with ralph-, keep it; otherwise prefix
    this.pm2Name = name.startsWith("ralph-") ? name : `ralph-${name}`;
    // State dir name strips ralph- prefix for .ralph-<name> convention
    const bare = name.startsWith("ralph-") ? name.slice(6) : name;
    this.stateDirName = `.ralph-${bare}`;

    const stateDir = overrides.stateDir ?? join(sourceRepo, "..", `${require("path").basename(sourceRepo)}-wt-${bare}`, this.stateDirName);
    this.stateDir = resolve(stateDir);
    this.stateFile = join(this.stateDir, "ralph-loop.state.json");
    this.inventoryFile = join(this.stateDir, "inventory.json");
    this.rulesFile = join(this.stateDir, "rules.toml");

    this.branch = overrides.branch ?? `wt/${bare}`;
    this.worktreePath = overrides.worktree ?? join(sourceRepo, "..", `${require("path").basename(sourceRepo)}-wt-${bare}`);

    if (overrides.goalFile) {
      this.goalFile = overrides.goalFile;
    } else {
      // Try to find _GOAL*.md in worktree
      this.goalFile = this.findGoalFile(this.worktreePath);
    }
  }

  private findGoalFile(dir: string): string | null {
    if (!existsSync(dir)) return null;
    try {
      const files = readdirSync(dir);
      const goal = files.find(f => f.startsWith("_GOAL") && f.endsWith(".md"));
      return goal ? join(dir, goal) : null;
    } catch {
      return null;
    }
  }
}

export function resolveConfig(name: string, sourceRepo: string, overrides: ConfigOverrides = {}): LoopConfig {
  return new LoopConfig(name, sourceRepo, overrides);
}
