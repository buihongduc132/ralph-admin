import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { RulesReader } from "../src/readers/rules-reader";
import type { RulesToml } from "../src/schemas/rules-toml";

describe("RulesReader", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ralph-admin-test-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("reads valid rules.toml", () => {
    const rulesFile = join(tmp, "rules.toml");
    writeFileSync(rulesFile, `[rules.modulo]
name = "modulo"
enabled = true
[[rules.modulo.entries]]
at = 5
prompt = "I%5 sync"
[[rules.modulo.entries]]
at = 7
prompt = "I%7 backward"
`);
    const reader = new RulesReader(rulesFile);
    const rules = reader.read()!;
    expect(rules.rules.modulo.name).toBe("modulo");
    expect(rules.rules.modulo.enabled).toBe(true);
    expect(rules.rules.modulo.entries).toHaveLength(2);
  });

  test("returns null for missing file", () => {
    const reader = new RulesReader(join(tmp, "nonexistent.toml"));
    expect(reader.read()).toBeNull();
  });

  test("returns null for malformed TOML", () => {
    const rulesFile = join(tmp, "rules.toml");
    writeFileSync(rulesFile, "[[[invalid toml {{{");
    const reader = new RulesReader(rulesFile);
    expect(reader.read()).toBeNull();
  });

  test("getActiveModulos returns only enabled entries", () => {
    const reader = new RulesReader("");
    const rules: RulesToml = {
      rules: {
        modulo: { name: "modulo", enabled: true, entries: [{ at: 5, prompt: "sync" }, { at: 7, prompt: "backward" }] },
        disabled: { name: "disabled", enabled: false, entries: [{ at: 3, prompt: "never" }] },
      },
    };
    const active = reader.getActiveModulos(rules);
    expect(active).toHaveLength(2);
    expect(active[0].at).toBe(5);
    expect(active[1].at).toBe(7);
  });
});
