import type { GoalId, OrchestrationV2ThreadGoal, ProviderTurnId, ThreadId } from "@piku/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  activeThreadGoal,
  foldProviderTurnIntoThreadGoal,
  foldTurnUsageIntoThreadGoal,
  isThreadGoalCounting,
  parseThreadGoalSlashCommand,
  parseThreadGoalTokenBudget,
  settleThreadGoalActiveTurn,
  threadGoalElapsedSeconds,
} from "./threadGoal.ts";

const t0 = DateTime.makeUnsafe("2026-08-01T10:00:00Z");
const at = (seconds: number) => DateTime.makeUnsafe(DateTime.toEpochMillis(t0) + seconds * 1_000);

const turnId = (value: string) => value as ProviderTurnId;

function makeGoal(overrides: Partial<OrchestrationV2ThreadGoal> = {}): OrchestrationV2ThreadGoal {
  return {
    id: "goal:test" as GoalId,
    threadId: "thread-1" as ThreadId,
    objective: "Ship the login fix",
    status: "active",
    statusReason: null,
    tokenBudget: null,
    tokensUsed: 0,
    timeUsedSeconds: 0,
    activeTurn: null,
    createdAt: t0,
    updatedAt: t0,
    completedAt: null,
    clearedAt: null,
    ...overrides,
  };
}

const usage = (id: string, totalTokens: number) => ({
  id: turnId(id),
  tokens: {
    inputTokens: totalTokens,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens,
  },
});

describe("activeThreadGoal", () => {
  it("returns the newest uncleared goal", () => {
    const cleared = makeGoal({ id: "goal:a" as GoalId, clearedAt: at(5) });
    const current = makeGoal({ id: "goal:b" as GoalId, createdAt: at(10) });
    expect(activeThreadGoal([cleared, current])?.id).toBe("goal:b");
  });

  it("returns null when every goal is cleared", () => {
    expect(activeThreadGoal([makeGoal({ clearedAt: t0 })])).toBeNull();
  });
});

describe("isThreadGoalCounting", () => {
  it("counts active, blocked, and limited goals", () => {
    for (const status of ["active", "blocked", "usageLimited", "budgetLimited"] as const) {
      expect(isThreadGoalCounting(makeGoal({ status }))).toBe(true);
    }
  });

  it("does not count paused, complete, or cleared goals", () => {
    expect(isThreadGoalCounting(makeGoal({ status: "paused" }))).toBe(false);
    expect(isThreadGoalCounting(makeGoal({ status: "complete" }))).toBe(false);
    expect(isThreadGoalCounting(makeGoal({ clearedAt: t0 }))).toBe(false);
  });
});

describe("foldTurnUsageIntoThreadGoal", () => {
  it("opens the turn cursor and counts cumulative usage", () => {
    const first = foldTurnUsageIntoThreadGoal({
      goal: makeGoal(),
      usage: usage("turn-1", 1_000),
      now: at(1),
    });
    expect(first?.tokensUsed).toBe(1_000);
    expect(first?.activeTurn?.providerTurnId).toBe("turn-1");

    const second = foldTurnUsageIntoThreadGoal({
      goal: first!,
      usage: usage("turn-1", 2_500),
      now: at(2),
    });
    expect(second?.tokensUsed).toBe(2_500);
  });

  it("settles across turns without double counting", () => {
    let goal = foldTurnUsageIntoThreadGoal({
      goal: makeGoal(),
      usage: usage("turn-1", 2_000),
      now: at(1),
    })!;
    goal = foldTurnUsageIntoThreadGoal({ goal, usage: usage("turn-2", 300), now: at(10) })!;
    expect(goal.tokensUsed).toBe(2_300);
    expect(goal.activeTurn?.tokensAtStart).toBe(2_000);
  });

  it("returns null for repeat readings and paused goals", () => {
    const goal = foldTurnUsageIntoThreadGoal({
      goal: makeGoal(),
      usage: usage("turn-1", 1_000),
      now: at(1),
    })!;
    expect(
      foldTurnUsageIntoThreadGoal({ goal, usage: usage("turn-1", 1_000), now: at(2) }),
    ).toBeNull();
    expect(
      foldTurnUsageIntoThreadGoal({
        goal: makeGoal({ status: "paused" }),
        usage: usage("turn-1", 1_000),
        now: at(2),
      }),
    ).toBeNull();
  });

  it("flips an active goal to budgetLimited at the budget", () => {
    const goal = foldTurnUsageIntoThreadGoal({
      goal: makeGoal({ tokenBudget: 2_000 }),
      usage: usage("turn-1", 2_400),
      now: at(1),
    });
    expect(goal?.status).toBe("budgetLimited");
    expect(goal?.statusReason).toBe("Token budget reached");
  });
});

describe("foldProviderTurnIntoThreadGoal", () => {
  it("opens the cursor when a turn starts and settles elapsed time on terminal", () => {
    const started = foldProviderTurnIntoThreadGoal({
      goal: makeGoal(),
      turn: { id: turnId("turn-1"), status: "running", startedAt: at(0), completedAt: null },
      now: at(0),
    })!;
    expect(started.activeTurn?.providerTurnId).toBe("turn-1");

    const settled = foldProviderTurnIntoThreadGoal({
      goal: started,
      turn: { id: turnId("turn-1"), status: "completed", startedAt: at(0), completedAt: at(42) },
      now: at(45),
    })!;
    expect(settled.timeUsedSeconds).toBe(42);
    expect(settled.activeTurn).toBeNull();
  });

  it("ignores terminals for turns the goal is not tracking", () => {
    expect(
      foldProviderTurnIntoThreadGoal({
        goal: makeGoal(),
        turn: { id: turnId("turn-9"), status: "completed", startedAt: at(0), completedAt: at(5) },
        now: at(5),
      }),
    ).toBeNull();
  });
});

describe("settleThreadGoalActiveTurn / threadGoalElapsedSeconds", () => {
  it("folds the open cursor into timeUsedSeconds", () => {
    const goal = makeGoal({
      timeUsedSeconds: 10,
      activeTurn: { providerTurnId: turnId("turn-1"), startedAt: at(0), tokensAtStart: 0 },
    });
    expect(settleThreadGoalActiveTurn(goal, at(30)).timeUsedSeconds).toBe(40);
    expect(threadGoalElapsedSeconds(goal, DateTime.toEpochMillis(at(30)))).toBe(40);
  });
});

describe("parseThreadGoalTokenBudget", () => {
  it("parses plain, k, and m budgets", () => {
    expect(parseThreadGoalTokenBudget("50000")).toBe(50_000);
    expect(parseThreadGoalTokenBudget("50k")).toBe(50_000);
    expect(parseThreadGoalTokenBudget("1.5m")).toBe(1_500_000);
  });

  it("rejects junk", () => {
    expect(parseThreadGoalTokenBudget("")).toBeNull();
    expect(parseThreadGoalTokenBudget("0")).toBeNull();
    expect(parseThreadGoalTokenBudget("-5k")).toBeNull();
    expect(parseThreadGoalTokenBudget("lots")).toBeNull();
  });
});

describe("parseThreadGoalSlashCommand", () => {
  it("parses objectives with an optional budget flag", () => {
    expect(parseThreadGoalSlashCommand("/goal Ship the login fix --budget 50k")).toEqual({
      action: "set",
      objective: "Ship the login fix",
      tokenBudget: 50_000,
    });
    expect(parseThreadGoalSlashCommand("/goal Ship it")).toEqual({
      action: "set",
      objective: "Ship it",
      tokenBudget: null,
    });
  });

  it("parses control verbs and bare /goal", () => {
    expect(parseThreadGoalSlashCommand("/goal pause")).toEqual({ action: "pause" });
    expect(parseThreadGoalSlashCommand("/goal resume")).toEqual({ action: "resume" });
    expect(parseThreadGoalSlashCommand("/goal done")).toEqual({ action: "done" });
    expect(parseThreadGoalSlashCommand("/goal clear")).toEqual({ action: "clear" });
    expect(parseThreadGoalSlashCommand("/goal")).toEqual({ action: "show" });
  });

  it("returns null for non-goal text", () => {
    expect(parseThreadGoalSlashCommand("/plan")).toBeNull();
    expect(parseThreadGoalSlashCommand("goal: ship it")).toBeNull();
    expect(parseThreadGoalSlashCommand("/goals are great")).toBeNull();
  });
});
