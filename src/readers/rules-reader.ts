import { readFileSync, existsSync } from "fs";
import { parse } from "smol-toml";
import type { RulesToml, ModuloEntry } from "../schemas/rules-toml";

export class RulesReader {
  constructor(private readonly filePath: string) {}

  /** Read and parse rules.toml. Returns null if missing or malformed. */
  read(): RulesToml | null {
    if (!existsSync(this.filePath)) return null;
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      return parse(raw) as unknown as RulesToml;
    } catch {
      return null;
    }
  }

  /** Get all enabled modulo entries. */
  getActiveModulos(rules: RulesToml): ModuloEntry[] {
    const entries: ModuloEntry[] = [];
    for (const rule of Object.values(rules.rules)) {
      if (rule.enabled) {
        entries.push(...rule.entries);
      }
    }
    return entries.sort((a, b) => a.at - b.at);
  }
}
