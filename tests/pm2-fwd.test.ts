import { describe, test, expect } from "bun:test";
import { derivePm2Name, normalizeProcess } from "../src/pm2-fwd";

describe("pm2-fwd", () => {
  test("derivePm2Name adds prefix to bare name", () => {
    expect(derivePm2Name("my-feature")).toBe("ralph-my-feature");
  });

  test("derivePm2Name keeps already-prefixed name", () => {
    expect(derivePm2Name("ralph-my-feature")).toBe("ralph-my-feature");
  });

  test("normalizeProcess maps PM2 jlist fields", () => {
    const raw = {
      name: "ralph-test",
      pm_id: 0,
      pid: 123,
      pm2_env: {
        status: "online",
        restart_time: 5,
        pm_uptime: 1000,
        pm_cwd: "/tmp/project",
      },
      monit: { memory: 1024, cpu: 10 },
    };
    const p = normalizeProcess(raw);
    expect(p.name).toBe("ralph-test");
    expect(p.pid).toBe(123);
    expect(p.status).toBe("online");
    expect(p.restarts).toBe(5);
    expect(p.uptime).toBe(1000);
    expect(p.memory).toBe(1024);
    expect(p.cpu).toBe(10);
    expect(p.cwd).toBe("/tmp/project");
  });

  test("normalizeProcess handles missing fields gracefully", () => {
    const raw = {};
    const p = normalizeProcess(raw);
    expect(p.name).toBe("");
    expect(p.pid).toBe(0);
    expect(p.status).toBe("unknown");
    expect(p.restarts).toBe(0);
  });

  test("normalizeProcess handles partial pm2_env", () => {
    const raw = { name: "ralph-x", pm2_env: { status: "stopped" } };
    const p = normalizeProcess(raw);
    expect(p.name).toBe("ralph-x");
    expect(p.status).toBe("stopped");
    expect(p.pid).toBe(0);
  });
});
