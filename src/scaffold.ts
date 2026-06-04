import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { stringify } from "smol-toml";

const DEFAULT_RULES_TOML = `[rules.modulo]
name = "modulo"
enabled = true
[[rules.modulo.entries]]
at = 5
prompt = "I%5 sync"
[[rules.modulo.entries]]
at = 7
prompt = "I%7 backward"
[[rules.modulo.entries]]
at = 11
prompt = "I%11 deep review"
[[rules.modulo.entries]]
at = 15
prompt = "I%15 guard cycle"
`;

const DEFAULT_INVENTORY = {
  lastUpdated: new Date().toISOString(),
  currentPhase: "P0",
  phases: {
    P0: {
      status: "open",
      tasks: {} as Record<string, unknown>,
    },
  },
};

export class ScaffoldBuilder {
  /** Create state dir with rules.toml and inventory.json. Returns created/skipped lists. */
  scaffoldStateDir(
    stateDir: string,
    name: string,
  ): { created: string[]; skipped: string[] } {
    const created: string[] = [];
    const skipped: string[] = [];

    // Create state dir
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }

    // Write rules.toml
    const rulesFile = join(stateDir, "rules.toml");
    if (existsSync(rulesFile)) {
      skipped.push(rulesFile);
    } else {
      writeFileSync(rulesFile, DEFAULT_RULES_TOML, "utf-8");
      created.push(rulesFile);
    }

    // Write inventory.json
    const invFile = join(stateDir, "inventory.json");
    if (existsSync(invFile)) {
      skipped.push(invFile);
    } else {
      writeFileSync(invFile, JSON.stringify(DEFAULT_INVENTORY, null, 2), "utf-8");
      created.push(invFile);
    }

    return { created, skipped };
  }

  /** Build the bash command string to start ralph via PM2 */
  buildStartCommand(opts: {
    name: string;
    worktreePath: string;
    stateDirName: string;
    goalFile: string;
    model: string;
    reuseState: boolean;
  }): string {
    const parts = [
      `cd ${opts.worktreePath}`,
      "&&",
      "ralph-dev",
      `--state-dir ${opts.stateDirName}`,
      `--model ${opts.model}`,
      `--no-commit`,
    ];
    if (opts.reuseState) {
      parts.push("--reuse-state");
    }
    parts.push(opts.goalFile);
    return parts.join(" ");
  }
}
