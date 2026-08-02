import type { OrchestrationV2ThreadGoal } from "@piku/contracts";
import { isThreadGoalCounting, threadGoalElapsedSeconds } from "@piku/shared/threadGoal";
import {
  CheckIcon,
  CircleAlertIcon,
  CirclePauseIcon,
  EllipsisIcon,
  PauseIcon,
  PlayIcon,
  TargetIcon,
  XIcon,
} from "lucide-react";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";

import { cn } from "~/lib/utils";
import {
  Menu,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import {
  DEFAULT_GOAL_UI_VARIANT,
  goalLedgerStatus,
  type GoalLedgerStatusIcon,
  GOAL_STATUS_TONE_COLOR_VAR,
  GOAL_STATUS_TONE_DOT_CLASS,
  GOAL_STATUS_TONE_TEXT_CLASS,
  GOAL_UI_VARIANTS,
  GOAL_UI_VARIANT_CHANGE_EVENT,
  GOAL_UI_VARIANT_STORAGE_KEY,
  formatGoalDuration,
  formatGoalTokens,
  goalBudgetFraction,
  goalBudgetMeterColor,
  goalStatusPresentation,
  parseGoalUiVariant,
  type GoalUiVariantId,
} from "./goalPresentation";

export type GoalCardAction = "pause" | "resume" | "done" | "clear";

interface GoalRenderContext {
  readonly goal: OrchestrationV2ThreadGoal;
  readonly statusLabel: string;
  readonly caption: string;
  readonly toneText: string;
  readonly toneDot: string;
  readonly toneColor: string;
  readonly tokensLabel: string;
  readonly budgetLabel: string | null;
  readonly timeLabel: string;
  readonly fraction: number | null;
  readonly meterColor: string;
  /** True while an open provider turn is charging the goal. */
  readonly working: boolean;
  readonly menu: ReactNode;
}

function subscribeToVariant(onChange: () => void): () => void {
  window.addEventListener(GOAL_UI_VARIANT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(GOAL_UI_VARIANT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStoredVariant(): GoalUiVariantId {
  try {
    return parseGoalUiVariant(window.localStorage.getItem(GOAL_UI_VARIANT_STORAGE_KEY));
  } catch {
    return DEFAULT_GOAL_UI_VARIANT;
  }
}

export function useGoalUiVariant(): [GoalUiVariantId, (variant: GoalUiVariantId) => void] {
  const variant = useSyncExternalStore(
    subscribeToVariant,
    readStoredVariant,
    () => DEFAULT_GOAL_UI_VARIANT,
  );
  const setVariant = (next: GoalUiVariantId) => {
    try {
      window.localStorage.setItem(GOAL_UI_VARIANT_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the event still updates state.
    }
    window.dispatchEvent(new Event(GOAL_UI_VARIANT_CHANGE_EVENT));
  };
  return [variant, setVariant];
}

/** Ticks once a second while an open turn is charging the goal. */
function useGoalElapsedSeconds(goal: OrchestrationV2ThreadGoal): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const ticking = goal.activeTurn !== null && goal.clearedAt === null;
  useEffect(() => {
    if (!ticking) {
      return;
    }
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [ticking]);
  return threadGoalElapsedSeconds(goal, nowMs);
}

function GoalMenu(props: {
  goal: OrchestrationV2ThreadGoal;
  variant: GoalUiVariantId;
  onAction: (action: GoalCardAction) => void;
  onVariantChange: (variant: GoalUiVariantId) => void;
  triggerClassName?: string;
}) {
  const { goal, variant, onAction, onVariantChange } = props;
  const paused = goal.status === "paused";
  const complete = goal.status === "complete";
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label="Goal actions"
            className={cn(
              "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/70 outline-none transition-colors",
              "hover:bg-accent hover:text-foreground data-[popup-open]:bg-accent data-[popup-open]:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring",
              props.triggerClassName,
            )}
          >
            <EllipsisIcon className="size-3.5" />
          </button>
        }
      />
      <MenuPopup align="end" className="min-w-44">
        {complete ? null : paused ? (
          <MenuItem onClick={() => onAction("resume")}>
            <PlayIcon className="size-3.5" /> Resume
          </MenuItem>
        ) : (
          <MenuItem onClick={() => onAction("pause")}>
            <PauseIcon className="size-3.5" /> Pause
          </MenuItem>
        )}
        {complete ? null : (
          <MenuItem onClick={() => onAction("done")}>
            <CheckIcon className="size-3.5" /> Mark done
          </MenuItem>
        )}
        <MenuItem onClick={() => onAction("clear")}>
          <XIcon className="size-3.5" /> Clear goal
        </MenuItem>
        <MenuSeparator />
        <MenuGroupLabel className="px-2 py-1 text-[10px] text-muted-foreground/70">
          Display style
        </MenuGroupLabel>
        <MenuRadioGroup
          value={variant}
          onValueChange={(value) => onVariantChange(parseGoalUiVariant(String(value)))}
        >
          {GOAL_UI_VARIANTS.map((entry) => (
            <MenuRadioItem key={entry.id} value={entry.id}>
              {entry.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}

function BudgetBar(props: {
  fraction: number | null;
  color: string;
  className?: string;
  trackClassName?: string;
}) {
  if (props.fraction === null) {
    return null;
  }
  const percent = Math.round(props.fraction * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Token budget used"
      className={cn("h-1 w-full overflow-hidden rounded-full bg-muted/70", props.className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none",
          props.trackClassName,
        )}
        style={{ width: `${Math.max(2, percent)}%`, backgroundColor: props.color }}
      />
    </div>
  );
}

function StatusDot(props: { toneDot: string; working: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", props.className)} aria-hidden>
      <span
        className={cn(
          "absolute inset-0 rounded-full",
          props.toneDot,
          props.working && "animate-status-pulse",
        )}
      />
      {props.working ? (
        <span
          className={cn(
            "absolute inset-0 rounded-full animate-status-ping motion-reduce:animate-none",
            props.toneDot,
          )}
        />
      ) : null}
    </span>
  );
}

const LEDGER_STATUS_ICONS: Record<GoalLedgerStatusIcon, ComponentType<{ className?: string }>> = {
  paused: CirclePauseIcon,
  alert: CircleAlertIcon,
};

/*
 * 1 — Ledger strip: one quiet dense line, hairline budget burn underneath.
 * The thread's own status already says whether the agent is running or
 * finished, so the card stays silent for active and completed goals — the
 * ticking counters carry liveness. A status cluster (borrowing the sidebar
 * thread row's grammar) appears only for goal-specific conditions the thread
 * status cannot express: paused, blocked, usage limit, budget hit.
 */
function LedgerVariant(context: GoalRenderContext) {
  const status =
    context.goal.status === "active" || context.goal.status === "complete"
      ? null
      : goalLedgerStatus(context.goal.status);
  const StatusIcon = status === null ? null : LEDGER_STATUS_ICONS[status.icon];
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 shadow-xs">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span
          className="min-w-0 flex-1 truncate font-medium text-[13px] text-foreground"
          title={context.goal.objective}
        >
          {context.goal.objective}
        </span>
        {status !== null && StatusIcon !== null ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
              status.className,
            )}
          >
            <StatusIcon aria-hidden className="size-4 shrink-0" />
            <span role="status">{status.label}</span>
          </span>
        ) : null}
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {context.timeLabel}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {context.tokensLabel}
          {context.budgetLabel === null ? " tok" : ` / ${context.budgetLabel} tok`}
        </span>
        {context.menu}
      </div>
      {/* The burn hairline is runway, not history: under a Done or Paused
          label a part-filled bar reads as stalled progress, so it only shows
          while the goal can still consume budget. */}
      {context.fraction !== null && isThreadGoalCounting(context.goal) ? (
        <BudgetBar
          fraction={context.fraction}
          color={context.meterColor}
          className="h-0.5 rounded-none rounded-b-xl bg-transparent"
        />
      ) : null}
    </div>
  );
}

/* 2 — Meter card: named panel, full meter with scale, stats row. */
function MeterVariant(context: GoalRenderContext) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-3.5 py-3 shadow-xs">
      <div className="flex items-center gap-1.5">
        <TargetIcon className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-[11px] font-medium text-muted-foreground">Goal</span>
        <span className={cn("ml-auto text-[11px] font-medium", context.toneText)}>
          {context.statusLabel}
        </span>
        {context.menu}
      </div>
      <p
        className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-foreground"
        title={context.goal.objective}
      >
        {context.goal.objective}
      </p>
      {context.fraction !== null ? (
        <BudgetBar
          fraction={context.fraction}
          color={context.meterColor}
          className="mt-2.5 h-1.5"
        />
      ) : null}
      <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>
          {context.tokensLabel}
          {context.budgetLabel === null ? " tokens" : ` of ${context.budgetLabel} tokens`}
        </span>
        <span>{context.timeLabel}</span>
      </div>
    </div>
  );
}

/* 3 — Ring gauge: budget burn as a dial beside the objective. */
function RingVariant(context: GoalRenderContext) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const fraction = context.fraction;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-3.5 py-2.5 shadow-xs">
      <span
        className="relative flex size-10 shrink-0 items-center justify-center"
        {...(fraction === null
          ? { "aria-label": `${formatGoalTokens(context.goal.tokensUsed)} tokens used` }
          : {
              role: "progressbar",
              "aria-valuemin": 0,
              "aria-valuemax": 100,
              "aria-valuenow": Math.round(fraction * 100),
              "aria-label": "Token budget used",
            })}
      >
        <svg viewBox="0 0 36 36" className="-rotate-90 absolute inset-0 size-full" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            strokeWidth="3"
            stroke="color-mix(in oklab, var(--color-muted-foreground) 22%, transparent)"
            strokeDasharray={fraction === null ? "2 4" : undefined}
          />
          {fraction !== null ? (
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              stroke={context.meterColor}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - fraction * circumference}
              className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
            />
          ) : null}
        </svg>
        <span className="text-[9px] font-semibold tabular-nums text-muted-foreground">
          {fraction === null
            ? formatGoalTokens(context.goal.tokensUsed)
            : `${Math.round(fraction * 100)}%`}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] font-medium text-foreground"
          title={context.goal.objective}
        >
          {context.goal.objective}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <StatusDot toneDot={context.toneDot} working={context.working} className="size-1.5" />
          <span className={context.toneText}>{context.statusLabel}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {context.tokensLabel}
            {context.budgetLabel === null ? "" : ` / ${context.budgetLabel}`} tok
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{context.timeLabel}</span>
        </p>
      </div>
      {context.menu}
    </div>
  );
}

/* 4 — Console readout: labeled measurement rows, mono values. */
function ConsoleVariant(context: GoalRenderContext) {
  const rows: ReadonlyArray<{ label: string; value: ReactNode }> = [
    {
      label: "objective",
      value: (
        <span className="block truncate text-foreground" title={context.goal.objective}>
          {context.goal.objective}
        </span>
      ),
    },
    {
      label: "status",
      value: (
        <span className={cn("inline-flex items-center gap-1.5 font-mono", context.toneText)}>
          <StatusDot toneDot={context.toneDot} working={context.working} className="size-1.5" />
          {context.statusLabel.toLowerCase()}
          {context.goal.statusReason !== null ? (
            <span className="truncate font-sans text-muted-foreground">
              — {context.goal.statusReason}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      label: "tokens",
      value: (
        <span className="font-mono tabular-nums text-foreground/90">
          {context.tokensLabel}
          {context.budgetLabel === null ? (
            ""
          ) : (
            <span className="text-muted-foreground/70"> / {context.budgetLabel}</span>
          )}
        </span>
      ),
    },
    {
      label: "time",
      value: <span className="font-mono tabular-nums text-foreground/90">{context.timeLabel}</span>,
    },
  ];
  return (
    <div className="rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2.5">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-start gap-x-3">
        <div className="col-span-2 grid grid-cols-subgrid gap-y-1 text-[12px] leading-5">
          {rows.map((row) => (
            <div key={row.label} className="col-span-2 grid grid-cols-subgrid">
              <span className="font-mono text-[10px] uppercase leading-5 tracking-wide text-muted-foreground">
                {row.label}
              </span>
              <span className="min-w-0">{row.value}</span>
            </div>
          ))}
        </div>
        {context.menu}
      </div>
    </div>
  );
}

/* 5 — Segment bar: budget burn as discrete cells. */
function SegmentsVariant(context: GoalRenderContext) {
  const cellCount = 24;
  const filled = context.fraction === null ? 0 : Math.round(context.fraction * cellCount);
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-3.5 py-2.5 shadow-xs">
      <div className="flex items-center gap-2">
        <StatusDot toneDot={context.toneDot} working={context.working} />
        <span
          className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"
          title={context.goal.objective}
        >
          {context.goal.objective}
        </span>
        <span className={cn("shrink-0 text-[11px] font-medium", context.toneText)}>
          {context.statusLabel}
        </span>
        {context.menu}
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        {context.fraction !== null ? (
          <div
            className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-px"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(context.fraction * 100)}
            aria-label="Token budget used"
          >
            {Array.from({ length: cellCount }, (_, index) => (
              <span
                key={index}
                className="h-1.5 rounded-[1px] bg-muted/80 transition-colors duration-300"
                style={index < filled ? { backgroundColor: context.meterColor } : undefined}
              />
            ))}
          </div>
        ) : (
          <span className="flex-1 text-[11px] text-muted-foreground">No token budget set</span>
        )}
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {context.tokensLabel}
          {context.budgetLabel === null ? "" : `/${context.budgetLabel}`} · {context.timeLabel}
        </span>
      </div>
    </div>
  );
}

/* 6 — Marginalia: chromeless, ruled typography with marginal annotations. */
function MarginaliaVariant(context: GoalRenderContext) {
  return (
    <div className="border-y border-border/70 px-1 py-2">
      <div className="flex items-baseline gap-3">
        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", context.toneText)}>
          {context.statusLabel}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-[13px] text-foreground"
          title={context.goal.objective}
        >
          {context.goal.objective}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {context.tokensLabel}
          {context.budgetLabel === null ? " tok" : ` / ${context.budgetLabel} tok`}
          <span className="mx-1.5 text-border" aria-hidden>
            |
          </span>
          {context.timeLabel}
        </span>
        {context.menu}
      </div>
      {context.goal.statusReason !== null ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{context.goal.statusReason}</p>
      ) : null}
    </div>
  );
}

/* 7 — Chip rail: every fact is its own pill. */
function ChipsVariant(context: GoalRenderContext) {
  const chip = "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px]";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(chip, "font-medium", context.toneText)}
        style={{
          backgroundColor: `color-mix(in oklab, ${GOAL_STATUS_TONE_COLOR_VAR[toneOf(context)]} 12%, transparent)`,
        }}
      >
        <StatusDot toneDot={context.toneDot} working={context.working} className="size-1.5" />
        {context.statusLabel}
      </span>
      <span
        className={cn(chip, "min-w-0 max-w-full flex-1 border border-border/60 bg-card/80")}
        title={context.goal.objective}
      >
        <TargetIcon className="size-3 shrink-0 text-muted-foreground/70" aria-hidden />
        <span className="truncate text-foreground">{context.goal.objective}</span>
      </span>
      <span className={cn(chip, "bg-muted/70 tabular-nums text-muted-foreground")}>
        {context.tokensLabel}
        {context.budgetLabel === null ? "" : ` / ${context.budgetLabel}`} tok
      </span>
      <span className={cn(chip, "bg-muted/70 tabular-nums text-muted-foreground")}>
        {context.timeLabel}
      </span>
      {context.menu}
    </div>
  );
}

function toneOf(context: GoalRenderContext): keyof typeof GOAL_STATUS_TONE_COLOR_VAR {
  return goalStatusPresentation(context.goal.status).tone;
}

/* 8 — Counter: the numbers lead, the objective supports. */
function CounterVariant(context: GoalRenderContext) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-3.5 py-2.5 shadow-xs">
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 items-baseline gap-1">
          <span className="text-lg font-semibold tabular-nums leading-6 text-foreground">
            {context.goal.tokensUsed.toLocaleString("en-US")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {context.budgetLabel === null ? "tokens" : `/ ${context.budgetLabel} tokens`}
          </span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 border-l border-border/60 pl-4">
          <span className="text-lg font-semibold tabular-nums leading-6 text-foreground">
            {context.timeLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">elapsed</span>
        </div>
        <span
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1.5 text-[11px] font-medium",
            context.toneText,
          )}
        >
          <StatusDot toneDot={context.toneDot} working={context.working} className="size-1.5" />
          {context.statusLabel}
        </span>
        {context.menu}
      </div>
      <p className="mt-1 truncate text-[12px] text-muted-foreground" title={context.goal.objective}>
        {context.goal.objective}
      </p>
    </div>
  );
}

/* 9 — Status trail: the goal lifecycle as stations. */
function TimelineVariant(context: GoalRenderContext) {
  const held =
    context.goal.status === "paused" ||
    context.goal.status === "blocked" ||
    context.goal.status === "usageLimited" ||
    context.goal.status === "budgetLimited";
  const stations = [
    { id: "set", label: "Set", state: "past" as const },
    {
      id: "working",
      label: "Working",
      state: context.goal.status === "active" ? ("current" as const) : ("past" as const),
    },
    ...(held ? [{ id: "held", label: context.statusLabel, state: "current" as const }] : []),
    {
      id: "done",
      label: "Done",
      state: context.goal.status === "complete" ? ("current" as const) : ("future" as const),
    },
  ];
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-3.5 py-2.5 shadow-xs">
      <div className="flex items-center gap-2">
        <div
          className="flex min-w-0 flex-1 items-center"
          aria-label={`Goal status: ${context.statusLabel}`}
        >
          {stations.map((station, index) => (
            <div
              key={station.id}
              className={cn("flex items-center", index > 0 && "min-w-0 flex-1")}
            >
              {index > 0 ? (
                <span
                  className={cn(
                    "mx-1.5 h-px min-w-3 flex-1",
                    station.state === "future" ? "bg-border/80" : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
              ) : null}
              <span className="flex shrink-0 items-center gap-1.5">
                {station.state === "current" ? (
                  <StatusDot
                    toneDot={context.toneDot}
                    working={context.working}
                    className="size-2"
                  />
                ) : (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      station.state === "past" ? "bg-muted-foreground/50" : "border border-border",
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "text-[11px]",
                    station.state === "current"
                      ? cn("font-medium", context.toneText)
                      : "text-muted-foreground/70",
                  )}
                >
                  {station.label}
                </span>
              </span>
            </div>
          ))}
        </div>
        {context.menu}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 flex-1 truncate text-foreground/90" title={context.goal.objective}>
          {context.goal.objective}
        </span>
        <span className="shrink-0 tabular-nums">
          {context.tokensLabel}
          {context.budgetLabel === null ? " tok" : ` / ${context.budgetLabel} tok`} ·{" "}
          {context.timeLabel}
        </span>
      </div>
    </div>
  );
}

const VARIANT_RENDERERS: Record<GoalUiVariantId, ComponentType<GoalRenderContext>> = {
  ledger: LedgerVariant,
  meter: MeterVariant,
  ring: RingVariant,
  console: ConsoleVariant,
  segments: SegmentsVariant,
  marginalia: MarginaliaVariant,
  chips: ChipsVariant,
  counter: CounterVariant,
  timeline: TimelineVariant,
};

export function GoalStatusCard(props: {
  goal: OrchestrationV2ThreadGoal;
  onAction: (action: GoalCardAction) => void;
  className?: string;
}) {
  const { goal, onAction } = props;
  const [variant, setVariant] = useGoalUiVariant();
  const elapsedSeconds = useGoalElapsedSeconds(goal);
  if (goal.clearedAt !== null) {
    return null;
  }
  const presentation = goalStatusPresentation(goal.status);
  const fraction = goalBudgetFraction(goal);
  const context: GoalRenderContext = {
    goal,
    statusLabel: presentation.label,
    caption: goal.statusReason ?? presentation.caption,
    toneText: GOAL_STATUS_TONE_TEXT_CLASS[presentation.tone],
    toneDot: GOAL_STATUS_TONE_DOT_CLASS[presentation.tone],
    toneColor: GOAL_STATUS_TONE_COLOR_VAR[presentation.tone],
    tokensLabel: formatGoalTokens(goal.tokensUsed),
    budgetLabel: goal.tokenBudget === null ? null : formatGoalTokens(goal.tokenBudget),
    timeLabel: formatGoalDuration(elapsedSeconds),
    fraction,
    meterColor:
      presentation.tone === "danger" || presentation.tone === "success"
        ? GOAL_STATUS_TONE_COLOR_VAR[presentation.tone]
        : goalBudgetMeterColor(fraction),
    working: goal.activeTurn !== null && goal.status === "active",
    menu: (
      <GoalMenu goal={goal} variant={variant} onAction={onAction} onVariantChange={setVariant} />
    ),
  };
  const Variant = VARIANT_RENDERERS[variant];
  return (
    <section
      aria-label={`Thread goal, ${presentation.label}`}
      data-goal-variant={variant}
      className={props.className}
    >
      <Variant {...context} />
    </section>
  );
}
