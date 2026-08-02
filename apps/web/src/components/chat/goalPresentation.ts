import type { OrchestrationV2ThreadGoal, OrchestrationV2ThreadGoalStatus } from "@piku/contracts";

import { formatContextWindowTokens } from "~/lib/contextWindow";

/**
 * Presentation vocabulary for thread goal status. Tones map onto the app's
 * semantic color tokens; every variant of the goal card shares this mapping so
 * a status reads identically no matter which display style is active.
 */
export type GoalStatusTone = "active" | "muted" | "warning" | "danger" | "success";

export interface GoalStatusPresentation {
  readonly label: string;
  readonly tone: GoalStatusTone;
  /** Default caption when the goal carries no statusReason. */
  readonly caption: string;
}

const GOAL_STATUS_PRESENTATION: Record<OrchestrationV2ThreadGoalStatus, GoalStatusPresentation> = {
  active: { label: "Active", tone: "active", caption: "Tracking usage toward the objective" },
  paused: { label: "Paused", tone: "muted", caption: "Tracking suspended" },
  blocked: { label: "Blocked", tone: "warning", caption: "Waiting on something outside the agent" },
  usageLimited: { label: "Usage limited", tone: "warning", caption: "Provider usage limit hit" },
  budgetLimited: { label: "Budget hit", tone: "danger", caption: "Token budget reached" },
  complete: { label: "Complete", tone: "success", caption: "Objective marked done" },
};

export function goalStatusPresentation(
  status: OrchestrationV2ThreadGoalStatus,
): GoalStatusPresentation {
  return GOAL_STATUS_PRESENTATION[status];
}

// Text and graphic tones use the *-foreground tokens (700-series light,
// 400-series dark) so 10-11px status labels clear 4.5:1 in both themes; the
// raw 500-series tokens stay on dots, which sit beside a readable label.
export const GOAL_STATUS_TONE_TEXT_CLASS: Record<GoalStatusTone, string> = {
  active: "text-primary",
  muted: "text-muted-foreground",
  warning: "text-warning-foreground",
  danger: "text-destructive-foreground",
  success: "text-success-foreground",
};

export const GOAL_STATUS_TONE_DOT_CLASS: Record<GoalStatusTone, string> = {
  active: "bg-primary",
  muted: "bg-muted-foreground/60",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
};

export const GOAL_STATUS_TONE_COLOR_VAR: Record<GoalStatusTone, string> = {
  active: "var(--primary)",
  muted: "color-mix(in oklab, var(--color-muted-foreground) 72%, transparent)",
  warning: "var(--warning-foreground)",
  danger: "var(--destructive-foreground)",
  success: "var(--success-foreground)",
};

export type GoalLedgerStatusIcon = "paused" | "alert";

export interface GoalLedgerStatus {
  readonly label: string;
  readonly icon: GoalLedgerStatusIcon;
  /**
   * Sidebar status hues, verbatim (SidebarV2 topStatus), so a goal reads the
   * same color language as the thread row that carries it.
   */
  readonly className: string;
}

/**
 * Ledger status cluster for goal-specific conditions only. Active and
 * completed goals show no label — the thread's own status already says
 * whether the agent is running or finished, and repeating it on the card
 * read as a duplicate.
 */
export function goalLedgerStatus(
  status: Exclude<OrchestrationV2ThreadGoalStatus, "active" | "complete">,
): GoalLedgerStatus {
  switch (status) {
    case "paused":
      return { label: "Paused", icon: "paused", className: "text-muted-foreground" };
    case "blocked":
      return { label: "Blocked", icon: "alert", className: "text-amber-700 dark:text-amber-300" };
    case "usageLimited":
      return {
        label: "Usage limit",
        icon: "alert",
        className: "text-amber-700 dark:text-amber-300",
      };
    case "budgetLimited":
      return { label: "Budget hit", icon: "alert", className: "text-red-700 dark:text-red-300" };
  }
}

export function formatGoalTokens(value: number): string {
  return formatContextWindowTokens(value);
}

export function formatGoalDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Budget burn as 0..1, or null when the goal has no token budget. */
export function goalBudgetFraction(
  goal: Pick<OrchestrationV2ThreadGoal, "tokenBudget" | "tokensUsed">,
): number | null {
  if (goal.tokenBudget === null || goal.tokenBudget <= 0) {
    return null;
  }
  return Math.max(0, Math.min(1, goal.tokensUsed / goal.tokenBudget));
}

/**
 * Meter color for budget burn: neutral while comfortable, warning past 70%,
 * danger past 90% — mirrors the context-window meter's overload ramp.
 */
export function goalBudgetMeterColor(fraction: number | null): string {
  if (fraction === null || fraction < 0.7) {
    return "color-mix(in oklab, var(--color-muted-foreground) 72%, transparent)";
  }
  return fraction < 0.9 ? "var(--warning-foreground)" : "var(--destructive-foreground)";
}

/** The nine goal card display styles shipped for evaluation. */
export const GOAL_UI_VARIANTS = [
  { id: "ledger", label: "Ledger strip" },
  { id: "meter", label: "Meter card" },
  { id: "ring", label: "Ring gauge" },
  { id: "console", label: "Console readout" },
  { id: "segments", label: "Segment bar" },
  { id: "marginalia", label: "Marginalia" },
  { id: "chips", label: "Chip rail" },
  { id: "counter", label: "Counter" },
  { id: "timeline", label: "Status trail" },
] as const;

export type GoalUiVariantId = (typeof GOAL_UI_VARIANTS)[number]["id"];

export const DEFAULT_GOAL_UI_VARIANT: GoalUiVariantId = "ledger";

export const GOAL_UI_VARIANT_STORAGE_KEY = "pikucode:goal-ui-variant";
export const GOAL_UI_VARIANT_CHANGE_EVENT = "pikucode:goal-ui-variant-change";

export function parseGoalUiVariant(raw: string | null | undefined): GoalUiVariantId {
  const match = GOAL_UI_VARIANTS.find((variant) => variant.id === raw);
  return match?.id ?? DEFAULT_GOAL_UI_VARIANT;
}
