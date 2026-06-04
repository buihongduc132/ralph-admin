import { describe, test, expect } from "bun:test";
import { Doctor, FleetInput, DiagnosisResult } from "../src/doctor";

describe("Doctor", () => {
  const doctor = new Doctor();

  test("detects crash-looping (high restarts + low iteration)", () => {
    const inputs: FleetInput[] = [
      { name: "ralph-bq-zod", status: "online", restarts: 1328, iteration: 1, noProgress: 5907, progressPct: 0, elapsedHours: 6 },
      { name: "ralph-goal-inv", status: "online", restarts: 5907, iteration: 1, noProgress: 5907, progressPct: 0, elapsedHours: 0.4 },
    ];
    const result = doctor.diagnose(inputs);
    expect(result.crashLooping).toHaveLength(2);
    expect(result.crashLooping[0].name).toBe("ralph-bq-zod");
    expect(result.crashLooping[1].name).toBe("ralph-goal-inv");
  });

  test("detects completed-but-running (100% + still online)", () => {
    const inputs: FleetInput[] = [
      { name: "ralph-beautifier", status: "online", restarts: 0, iteration: 150, noProgress: 0, progressPct: 100, elapsedHours: 5 },
    ];
    const result = doctor.diagnose(inputs);
    expect(result.completedRunning).toHaveLength(1);
    expect(result.completedRunning[0].name).toBe("ralph-beautifier");
  });

  test("detects stuck (high noProgress)", () => {
    const inputs: FleetInput[] = [
      { name: "ralph-stuck", status: "online", restarts: 0, iteration: 50, noProgress: 200, progressPct: 40, elapsedHours: 8 },
    ];
    const result = doctor.diagnose(inputs);
    expect(result.stuck).toHaveLength(1);
  });

  test("classifies healthy loops", () => {
    const inputs: FleetInput[] = [
      { name: "ralph-ok", status: "online", restarts: 0, iteration: 45, noProgress: 0, progressPct: 60, elapsedHours: 7 },
    ];
    const result = doctor.diagnose(inputs);
    expect(result.healthy).toHaveLength(1);
    expect(result.crashLooping).toHaveLength(0);
    expect(result.completedRunning).toHaveLength(0);
    expect(result.stuck).toHaveLength(0);
  });

  test("detects stopped processes", () => {
    const inputs: FleetInput[] = [
      { name: "ralph-paused", status: "stopped", restarts: 0, iteration: 10, noProgress: 0, progressPct: 30, elapsedHours: 2 },
    ];
    const result = doctor.diagnose(inputs);
    expect(result.stopped).toHaveLength(1);
  });

  test("mixed fleet — classifies all correctly", () => {
    const inputs: FleetInput[] = [
      { name: "ralph-crash", status: "online", restarts: 500, iteration: 1, noProgress: 500, progressPct: 0, elapsedHours: 1 },
      { name: "ralph-done", status: "online", restarts: 0, iteration: 200, noProgress: 0, progressPct: 100, elapsedHours: 10 },
      { name: "ralph-good", status: "online", restarts: 0, iteration: 30, noProgress: 0, progressPct: 50, elapsedHours: 4 },
      { name: "ralph-paused", status: "stopped", restarts: 0, iteration: 5, noProgress: 0, progressPct: 20, elapsedHours: 1 },
    ];
    const result = doctor.diagnose(inputs);
    expect(result.crashLooping).toHaveLength(1);
    expect(result.completedRunning).toHaveLength(1);
    expect(result.healthy).toHaveLength(1);
    expect(result.stopped).toHaveLength(1);
  });
});
