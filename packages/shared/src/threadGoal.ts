import type {
  OrchestrationV2ProviderTurn,
  OrchestrationV2ProviderTurnUsage,
  OrchestrationV2ThreadGoal,
} from "@piku/contracts";
import * as DateTime from "effect/DateTime";

/**
 * Shared goal accounting for orchestration V2 threads. The server-side goal
 * tracker folds provider signals through these helpers before emitting
 * `goal.updated`, and clients reuse the same arithmetic for live display, so
 * both ends agree on what a goal's counters mean.
 */

const COUNTING_PAUSED_STATUSES: ReadonlySet<OrchestrationV2ThreadGoal["status"]> = new Set([
  "paused",
  "complete",
]);

/**
 * The goal a thread is currently tracked against: the most recently created
 * goal that has not been cleared. Cleared goals stay in the projection as
 * history but never resume tracking.
 */
export function activeThreadGoal(
  goals: ReadonlyArray<OrchestrationV2ThreadGoal>,
): OrchestrationV2ThreadGoal | null {
  let latest: OrchestrationV2ThreadGoal | null = null;
  for (const goal of goals) {
    if (goal.clearedAt !== null) {
      continue;
    }
    if (
      latest === null ||
      DateTime.toEpochMillis(goal.createdAt) >= DateTime.toEpochMillis(latest.createdAt)
    ) {
      latest = goal;
    }
  }
  return latest;
}

/**
 * Whether provider activity should charge this goal. Paused and completed
 * goals stop accumulating; blocked and limited goals keep counting because the
 * thread may still be doing work the user wants attributed to the objective.
 */
export function isThreadGoalCounting(goal: OrchestrationV2ThreadGoal): boolean {
  return goal.clearedAt === null && !COUNTING_PAUSED_STATUSES.has(goal.status);
}

function withBudgetTransition(
  goal: OrchestrationV2ThreadGoal,
  now: DateTime.Utc,
): OrchestrationV2ThreadGoal {
  if (goal.status !== "active" || goal.tokenBudget === null || goal.tokensUsed < goal.tokenBudget) {
    return goal;
  }
  return {
    ...goal,
    status: "budgetLimited",
    statusReason: "Token budget reached",
    updatedAt: now,
  };
}

function elapsedSecondsBetween(start: DateTime.Utc, end: DateTime.Utc): number {
  return Math.max(
    0,
    Math.round((DateTime.toEpochMillis(end) - DateTime.toEpochMillis(start)) / 1000),
  );
}

/**
 * Fold a cumulative per-turn usage reading into the goal. Returns the updated
 * goal, or null when the reading changes nothing (repeat notifications).
 */
export function foldTurnUsageIntoThreadGoal(input: {
  readonly goal: OrchestrationV2ThreadGoal;
  readonly usage: Pick<OrchestrationV2ProviderTurnUsage, "id" | "tokens">;
  readonly now: DateTime.Utc;
}): OrchestrationV2ThreadGoal | null {
  const { goal, usage, now } = input;
  if (!isThreadGoalCounting(goal)) {
    return null;
  }
  const activeTurn =
    goal.activeTurn?.providerTurnId === usage.id
      ? goal.activeTurn
      : // Usage can land before the turn's running event; open the cursor here.
        { providerTurnId: usage.id, startedAt: now, tokensAtStart: goal.tokensUsed };
  const tokensUsed = Math.max(goal.tokensUsed, activeTurn.tokensAtStart + usage.tokens.totalTokens);
  if (tokensUsed === goal.tokensUsed && activeTurn === goal.activeTurn) {
    return null;
  }
  return withBudgetTransition({ ...goal, tokensUsed, activeTurn, updatedAt: now }, now);
}

/**
 * Fold a provider turn lifecycle update into the goal's time accounting.
 * Running turns open the accounting cursor; terminal turns settle elapsed
 * seconds and close it. Returns null when the update changes nothing.
 */
export function foldProviderTurnIntoThreadGoal(input: {
  readonly goal: OrchestrationV2ThreadGoal;
  readonly turn: Pick<OrchestrationV2ProviderTurn, "id" | "status" | "startedAt" | "completedAt">;
  readonly now: DateTime.Utc;
}): OrchestrationV2ThreadGoal | null {
  const { goal, turn, now } = input;
  if (!isThreadGoalCounting(goal)) {
    return null;
  }
  if (turn.status === "running" || turn.status === "pending") {
    if (goal.activeTurn?.providerTurnId === turn.id || turn.startedAt === null) {
      return null;
    }
    // A previous turn that never reported terminal still owes its elapsed time.
    const timeUsedSeconds =
      goal.activeTurn === null
        ? goal.timeUsedSeconds
        : goal.timeUsedSeconds + elapsedSecondsBetween(goal.activeTurn.startedAt, now);
    return {
      ...goal,
      timeUsedSeconds,
      activeTurn: {
        providerTurnId: turn.id,
        startedAt: turn.startedAt,
        tokensAtStart: goal.tokensUsed,
      },
      updatedAt: now,
    };
  }
  if (goal.activeTurn?.providerTurnId !== turn.id) {
    return null;
  }
  return {
    ...goal,
    timeUsedSeconds:
      goal.timeUsedSeconds +
      elapsedSecondsBetween(goal.activeTurn.startedAt, turn.completedAt ?? now),
    activeTurn: null,
    updatedAt: now,
  };
}

/**
 * Settle the open accounting cursor: fold its elapsed time into
 * `timeUsedSeconds` and close it. Used when a goal stops counting (pause,
 * complete, clear, supersede) so wall time after the transition never
 * charges the goal.
 */
export function settleThreadGoalActiveTurn(
  goal: OrchestrationV2ThreadGoal,
  now: DateTime.Utc,
): OrchestrationV2ThreadGoal {
  if (goal.activeTurn === null) {
    return goal;
  }
  return {
    ...goal,
    timeUsedSeconds: goal.timeUsedSeconds + elapsedSecondsBetween(goal.activeTurn.startedAt, now),
    activeTurn: null,
    updatedAt: now,
  };
}

/**
 * Elapsed goal time including the still-open turn, for live display. Counters
 * in the goal itself only settle when the tracker writes, so clients tick from
 * the active turn cursor between updates.
 */
export function threadGoalElapsedSeconds(
  goal: OrchestrationV2ThreadGoal,
  nowMillis: number,
): number {
  if (goal.activeTurn === null || !isThreadGoalCounting(goal)) {
    return goal.timeUsedSeconds;
  }
  return (
    goal.timeUsedSeconds +
    Math.max(0, Math.round((nowMillis - DateTime.toEpochMillis(goal.activeTurn.startedAt)) / 1000))
  );
}

/** Parse human token budgets: "50000", "50k", "1.5m". Null for anything else. */
export function parseThreadGoalTokenBudget(raw: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*([km])?$/i.exec(raw.trim());
  if (!match) {
    return null;
  }
  const magnitude = Number.parseFloat(match[1]!);
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    return null;
  }
  const multiplier =
    match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2]?.toLowerCase() === "k" ? 1_000 : 1;
  const budget = Math.round(magnitude * multiplier);
  return budget > 0 ? budget : null;
}

export type ThreadGoalSlashCommand =
  | {
      readonly action: "set";
      readonly objective: string;
      readonly tokenBudget: number | null;
    }
  | { readonly action: "pause" | "resume" | "done" | "clear" | "show" };

/**
 * Parse a standalone `/goal` composer submission.
 *
 *   /goal Ship the login fix --budget 50k
 *   /goal pause | resume | done | clear
 *   /goal            (show current goal)
 *
 * Returns null when the text is not a /goal command at all.
 */
export function parseThreadGoalSlashCommand(text: string): ThreadGoalSlashCommand | null {
  const match = /^\/goal(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) {
    return null;
  }
  const remainder = (match[1] ?? "").trim();
  if (remainder.length === 0) {
    return { action: "show" };
  }
  const verb = remainder.toLowerCase();
  if (verb === "pause" || verb === "resume" || verb === "done" || verb === "clear") {
    return { action: verb };
  }
  let tokenBudget: number | null = null;
  const objective = remainder
    .replace(/(?:^|\s)--budget[=\s]+(\S+)/i, (_, raw: string) => {
      tokenBudget = parseThreadGoalTokenBudget(raw);
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  if (objective.length === 0) {
    return { action: "show" };
  }
  return { action: "set", objective, tokenBudget };
}
