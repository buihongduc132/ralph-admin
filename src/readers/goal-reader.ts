import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const HEADER_MARKER = "<!-- ralph-admin:working-dir-header -->";
const HEADER_END = "<!-- /ralph-admin:working-dir-header -->";

export class GoalFileManager {
  constructor(private readonly searchDir: string) {}

  /** Find the first _GOAL*.md file in the search directory. */
  findGoalFile(): string | null {
    if (!existsSync(this.searchDir)) return null;
    try {
      const files = readdirSync(this.searchDir);
      const goal = files.find(f => f.startsWith("_GOAL") && f.endsWith(".md"));
      return goal ? join(this.searchDir, goal) : null;
    } catch {
      return null;
    }
  }

  /** Inject working-directory header into _GOAL file. Idempotent — skips if already present. */
  injectHeader(
    name: string,
    meta: { worktreePath: string; stateDir: string; branch: string },
  ): void {
    const goalFile = this.findGoalFile();
    if (!goalFile) {
      throw new Error(`No _GOAL file found in ${this.searchDir}`);
    }

    let content = readFileSync(goalFile, "utf-8");

    // Idempotent — skip if marker already exists
    if (content.includes(HEADER_MARKER)) {
      return;
    }

    const header = [
      HEADER_MARKER,
      `<!-- name: ${name} -->`,
      `<!-- worktree: ${meta.worktreePath} -->`,
      `<!-- stateDir: ${meta.stateDir} -->`,
      `<!-- branch: ${meta.branch} -->`,
      HEADER_END,
      "",
    ].join("\n");

    writeFileSync(goalFile, header + content, "utf-8");
  }
}
