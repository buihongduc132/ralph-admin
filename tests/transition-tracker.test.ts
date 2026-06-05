import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { TransitionTracker } from "../src/transition-tracker";
import type { GoalStateFile } from "../src/schemas/goal-state";

const TMP = join(import.meta.dir, "__transition_tmp__");

function makeStateFile(items: Array<{ id: string; status: string }>): GoalStateFile {
  return {
    filePath: join(TMP, "test-state.json"),
    name: "test",
    kind: "items",
    items: items.map(i => ({
      id: i.id,
      title: `Item ${i.id}`,
      status: i.status,
      phase: i.status.toUpperCase(),
    })),
  };
}

describe("TransitionTracker", () => {
  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  });

  test("records new items on first snapshot", () => {
    const tracker = new TransitionTracker();
    const state = makeStateFile([
      { id: "A", status: "todo" },
      { id: "B", status: "wip" },
    ]);

    const transitions = tracker.record(state);
    expect(transitions.length).toBe(2);
    expect(transitions[0].itemId).toBe("A");
    expect(transitions[0].from).toBe("(new)");
    expect(transitions[0].to).toBe("todo");
    expect(transitions[1].itemId).toBe("B");
  });

  test("detects status change between snapshots", () => {
    const tracker = new TransitionTracker();

    // First snapshot
    const state1 = makeStateFile([
      { id: "A", status: "todo" },
      { id: "B", status: "wip" },
    ]);
    tracker.record(state1);

    // Second snapshot — A moved to verified, B stayed wip
    const state2 = makeStateFile([
      { id: "A", status: "verified" },
      { id: "B", status: "wip" },
    ]);
    const transitions = tracker.record(state2);

    expect(transitions.length).toBe(1);
    expect(transitions[0].itemId).toBe("A");
    expect(transitions[0].from).toBe("todo");
    expect(transitions[0].to).toBe("verified");
  });

  test("detects regression (verified → wip)", () => {
    const tracker = new TransitionTracker();

    const state1 = makeStateFile([{ id: "A", status: "verified" }]);
    tracker.record(state1);

    const state2 = makeStateFile([{ id: "A", status: "wip" }]);
    const transitions = tracker.record(state2);

    expect(transitions.length).toBe(1);
    expect(transitions[0].from).toBe("verified");
    expect(transitions[0].to).toBe("wip");
  });

  test("findRegressions returns only backward transitions", () => {
    const tracker = new TransitionTracker();

    const state1 = makeStateFile([
      { id: "A", status: "todo" },
      { id: "B", status: "verified" },
    ]);
    tracker.record(state1);

    const state2 = makeStateFile([
      { id: "A", status: "verified" },  // forward
      { id: "B", status: "wip" },        // regression
    ]);
    tracker.record(state2);

    const regressions = tracker.findRegressions(state1.filePath);
    // The regression: B went from verified→wip (DONE→WIP)
    expect(regressions.length).toBe(1);
    expect(regressions[0].itemId).toBe("B");
  });

  test("summarize counts forward, regression, new", () => {
    const tracker = new TransitionTracker();

    const state1 = makeStateFile([
      { id: "A", status: "todo" },
      { id: "B", status: "verified" },
    ]);
    tracker.record(state1); // 2 new

    const state2 = makeStateFile([
      { id: "A", status: "verified" },  // forward
      { id: "B", status: "wip" },        // regression
    ]);
    tracker.record(state2);

    const summary = tracker.summarize(state1.filePath);
    expect(summary.total).toBe(4); // 2 new + 1 forward + 1 regression
    expect(summary.newItem).toBe(2);
    expect(summary.forward).toBe(1);
    expect(summary.regressions).toBe(1);
  });

  test("itemTimeline returns all transitions for one item", () => {
    const tracker = new TransitionTracker();

    const state1 = makeStateFile([{ id: "A", status: "todo" }]);
    tracker.record(state1);

    const state2 = makeStateFile([{ id: "A", status: "wip" }]);
    tracker.record(state2);

    const state3 = makeStateFile([{ id: "A", status: "verified" }]);
    tracker.record(state3);

    const timeline = tracker.itemTimeline(state1.filePath, "A");
    expect(timeline.length).toBe(3);
    expect(timeline[0].to).toBe("todo");     // new → todo
    expect(timeline[1].from).toBe("todo");
    expect(timeline[1].to).toBe("wip");
    expect(timeline[2].from).toBe("wip");
    expect(timeline[2].to).toBe("verified");
  });

  test("detects removed items", () => {
    const tracker = new TransitionTracker();

    const state1 = makeStateFile([
      { id: "A", status: "todo" },
      { id: "B", status: "todo" },
    ]);
    tracker.record(state1);

    // B disappears
    const state2 = makeStateFile([{ id: "A", status: "todo" }]);
    const transitions = tracker.record(state2);

    expect(transitions.length).toBe(1);
    expect(transitions[0].itemId).toBe("B");
    expect(transitions[0].to).toBe("(removed)");
  });

  test("formatTimeline produces human-readable output", () => {
    const tracker = new TransitionTracker();

    const state1 = makeStateFile([{ id: "A", status: "verified" }]);
    tracker.record(state1);

    const state2 = makeStateFile([{ id: "A", status: "wip" }]);
    tracker.record(state2);

    const history = tracker.readHistory(state1.filePath);
    const output = tracker.formatTimeline(history);
    expect(output).toContain("A:");
    expect(output).toContain("REGRESSION");
  });

  test("no transitions when nothing changed", () => {
    const tracker = new TransitionTracker();

    const state1 = makeStateFile([{ id: "A", status: "todo" }]);
    tracker.record(state1);

    const state2 = makeStateFile([{ id: "A", status: "todo" }]);
    const transitions = tracker.record(state2);

    expect(transitions.length).toBe(0);
  });

  test("full lifecycle: TODO → WIP → REVIEW → reject → WIP → REVIEW → DONE", () => {
    const tracker = new TransitionTracker();
    const filePath = join(TMP, "lifecycle-state.json");

    const statuses = ["todo", "wip", "review", "rejected", "wip", "review", "verified"];
    for (const status of statuses) {
      const state: GoalStateFile = {
        filePath,
        name: "lifecycle",
        kind: "items",
        items: [{ id: "A", title: "Item A", status, phase: status.toUpperCase() }],
      };
      tracker.record(state);
    }

    const timeline = tracker.itemTimeline(filePath, "A");
    // 7 transitions: new→todo, todo→wip, wip→review, review→rejected, rejected→wip, wip→review, review→verified
    expect(timeline.length).toBe(7);

    const regressions = tracker.findRegressions(filePath);
    // review→rejected is a regression (REVIEW → REJECTED)
    // rejected→wip is NOT a regression — it's rework after rejection (forward)
    expect(regressions.length).toBe(1);

    const summary = tracker.summarize(filePath);
    expect(summary.regressions).toBe(1);
    expect(summary.forward).toBe(5); // todo→wip, rejected→wip, wip→review, wip→review, review→verified
    expect(summary.newItem).toBe(1); // initial (new)→todo
  });
});
