import { execFileSync } from "child_process";

export interface RalphProcess {
  name: string;
  pid: number;
  status: string;
  restarts: number;
  uptime: number;    // ms since epoch
  memory: number;    // bytes
  cpu: number;       // %
  cwd: string;
}

export function derivePm2Name(name: string): string {
  return name.startsWith("ralph-") ? name : `ralph-${name}`;
}

export function normalizeProcess(raw: any): RalphProcess {
  return {
    name: raw.name ?? "",
    pid: raw.pid ?? 0,
    status: raw.pm2_env?.status ?? "unknown",
    restarts: raw.pm2_env?.restart_time ?? 0,
    uptime: raw.pm2_env?.pm_uptime ?? 0,
    memory: raw.monit?.memory ?? 0,
    cpu: raw.monit?.cpu ?? 0,
    cwd: raw.pm2_env?.pm_cwd ?? "",
  };
}

/** Read all ralph processes from PM2 via `pm2 jlist` */
export function listRalph(): RalphProcess[] {
  const json = execFileSync("pm2", ["jlist"], { encoding: "utf-8" });
  const all: any[] = JSON.parse(json);
  return all.filter(p => p.name?.startsWith("ralph-")).map(normalizeProcess);
}

/** Find process by name in a list */
export function findByName(procs: RalphProcess[], name: string): RalphProcess | undefined {
  const pm2Name = derivePm2Name(name);
  return procs.find(p => p.name === pm2Name);
}

/** Assert process exists, throw with clear error if not */
export function assertExists(procs: RalphProcess[], name: string): void {
  const pm2Name = derivePm2Name(name);
  if (!procs.find(p => p.name === pm2Name)) {
    throw new Error(`Process '${pm2Name}' not found in PM2. Run 'ralph-admin list' to see available loops.`);
  }
}

/** Forward stop to PM2 */
export function pm2Stop(name: string): void {
  execFileSync("pm2", ["stop", derivePm2Name(name)], { stdio: "pipe" });
}

/** Forward restart to PM2 */
export function pm2Restart(name: string): void {
  execFileSync("pm2", ["restart", derivePm2Name(name)], { stdio: "pipe" });
}

/** Forward delete to PM2 */
export function pm2Delete(name: string): void {
  execFileSync("pm2", ["delete", derivePm2Name(name)], { stdio: "pipe" });
}

/** Start ralph via PM2 */
export function pm2StartRalph(opts: {
  name: string;
  bashCommand: string;
  cwd: string;
}): void {
  execFileSync("pm2", [
    "start", "bash",
    "--name", opts.name,
    "--cwd", opts.cwd,
    "--max-memory-restart", "2G",
    "--restart-delay", "5000",
    "--", "-c", opts.bashCommand,
  ], { stdio: "pipe" });
}

/** Poll for process to be online with valid PID */
export function verifyStarted(pm2Name: string, maxAttempts = 3, delayMs = 2000): { pid: number } {
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      const end = Date.now() + delayMs;
      while (Date.now() < end) {} // busy-wait (sync)
    }
    const procs = listRalph();
    const found = procs.find(p => p.name === pm2Name);
    if (found && found.pid > 0 && found.status === "online") {
      return { pid: found.pid };
    }
  }
  throw new Error(`Process '${pm2Name}' did not start within ${maxAttempts * delayMs / 1000}s`);
}
