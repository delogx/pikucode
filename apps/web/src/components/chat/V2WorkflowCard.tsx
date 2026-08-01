import type {
  OrchestrationV2TurnItem,
  OrchestrationV2WorkflowAgent,
  OrchestrationV2WorkflowPhase,
  ThreadId,
} from "@piku/contracts";
import {
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  LoaderIcon,
  MinusIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";

import { formatDuration } from "../../session-logic";
import { formatContextWindowTokens } from "~/lib/contextWindow";
import { cn } from "~/lib/utils";

export type V2WorkflowItem = Extract<OrchestrationV2TurnItem, { readonly type: "workflow" }>;

const TERMINAL_WORKFLOW_STATUSES = new Set<OrchestrationV2TurnItem["status"]>([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);

const TERMINAL_AGENT_STATUSES = new Set<OrchestrationV2WorkflowAgent["status"]>([
  "completed",
  "failed",
  "cancelled",
]);

/**
 * Claude's provider-native model ids ("claude-haiku-4-5-20251001",
 * "claude-opus-5[1m]") reduce to the family + version for the compact agent
 * rows; unrecognized ids pass through untouched.
 */
export function workflowAgentModelLabel(model: string): string {
  const match = /^claude-([a-z]+)-(\d+(?:-\d+)*?)(?:-\d{8})?(?:\[|$)/u.exec(model);
  if (match?.[1] === undefined || match[2] === undefined) {
    return model;
  }
  const family = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return `${family} ${match[2].replaceAll("-", ".")}`;
}

interface WorkflowPhaseGroup {
  readonly key: string;
  readonly title: string;
  readonly index: number | null;
  readonly detail: string | null;
  readonly agents: ReadonlyArray<OrchestrationV2WorkflowAgent>;
}

/**
 * Groups agents under their declared phase, preserving phase order and
 * keeping agents whose phase is unknown (or whose phase was never declared)
 * in a trailing "Agents" bucket.
 */
export function groupWorkflowAgentsByPhase(input: {
  readonly phases: ReadonlyArray<OrchestrationV2WorkflowPhase>;
  readonly agents: ReadonlyArray<OrchestrationV2WorkflowAgent>;
}): ReadonlyArray<WorkflowPhaseGroup> {
  const knownIndexes = new Set(input.phases.map((phase) => phase.index));
  const groups = input.phases.map((phase) => ({
    key: `phase:${phase.index}`,
    title: phase.title,
    index: phase.index,
    detail: phase.detail ?? null,
    agents: input.agents.filter((agent) => agent.phaseIndex === phase.index),
  }));
  const ungrouped = input.agents.filter(
    (agent) => agent.phaseIndex === null || !knownIndexes.has(agent.phaseIndex),
  );
  return ungrouped.length === 0
    ? groups
    : [
        ...groups,
        { key: "phase:other", title: "Agents", index: null, detail: null, agents: ungrouped },
      ];
}

type WorkflowPhaseState = "pending" | "active" | "done" | "failed";

export function workflowPhaseState(
  group: WorkflowPhaseGroup,
  workflowTerminal: boolean,
): WorkflowPhaseState {
  if (group.agents.some((agent) => agent.status === "running")) {
    return "active";
  }
  if (group.agents.length === 0) {
    return "pending";
  }
  if (group.agents.some((agent) => agent.status === "failed")) {
    return "failed";
  }
  if (group.agents.every((agent) => TERMINAL_AGENT_STATUSES.has(agent.status))) {
    return "done";
  }
  return workflowTerminal ? "done" : "active";
}

function agentStats(agent: OrchestrationV2WorkflowAgent): string {
  return [
    ...(agent.model === null ? [] : [workflowAgentModelLabel(agent.model)]),
    ...(agent.totalTokens === undefined
      ? []
      : [`${formatContextWindowTokens(agent.totalTokens)} tok`]),
    ...(agent.durationMs === undefined ? [] : [formatDuration(agent.durationMs)]),
  ].join(" · ");
}

/** Inline status glyph for agent rows — the plan sidebar's palette at timeline scale. */
function AgentStatusIcon(props: { readonly status: OrchestrationV2WorkflowAgent["status"] }) {
  switch (props.status) {
    case "completed":
      return (
        <CheckIcon aria-label="completed" className="size-3 shrink-0 text-success-foreground" />
      );
    case "running":
      return (
        <LoaderIcon aria-label="running" className="size-3 shrink-0 animate-spin text-primary" />
      );
    case "failed":
      return <XIcon aria-label="failed" className="size-3 shrink-0 text-destructive" />;
    case "cancelled":
      return <MinusIcon aria-label="cancelled" className="size-3 shrink-0 text-muted-foreground" />;
    case "queued":
      return (
        <span aria-label="queued" className="flex size-3 shrink-0 items-center justify-center">
          <span className="size-1.5 rounded-full bg-muted-foreground/30" />
        </span>
      );
  }
}

/** The plan sidebar's step chip, reused verbatim so phases read as plan steps. */
function PhaseChip(props: { readonly state: WorkflowPhaseState }) {
  if (props.state === "done") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success-foreground">
        <CheckIcon className="size-3" />
      </span>
    );
  }
  if (props.state === "active") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LoaderIcon className="size-3 animate-spin" />
      </span>
    );
  }
  if (props.state === "failed") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <XIcon className="size-3" />
      </span>
    );
  }
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/30">
      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
    </span>
  );
}

export function V2WorkflowCard(props: {
  readonly item: V2WorkflowItem;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { item } = props;
  const isTerminal = TERMINAL_WORKFLOW_STATUSES.has(item.status);
  const groups = groupWorkflowAgentsByPhase({ phases: item.phases, agents: item.agents });
  const completedAgents = item.agents.filter((agent) => agent.status === "completed").length;
  const stats = [
    ...(item.agents.length === 0 ? [] : [`${completedAgents}/${item.agents.length} agents`]),
    ...(item.totalTokens === undefined
      ? []
      : [`${formatContextWindowTokens(item.totalTokens)} tok`]),
    ...(item.durationMs === undefined ? [] : [formatDuration(item.durationMs)]),
  ];
  const result = item.result?.trim() ? item.result : null;
  const childThreadId = item.childThreadId;
  const title = item.description.trim().length > 0 ? item.description : item.workflowName;
  return (
    <section
      data-v2-item-type="workflow"
      data-v2-workflow-status={item.status}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-lg border bg-card/30",
        item.status === "failed" ? "border-destructive/25 bg-destructive/5" : "border-border/60",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 px-3 py-2 pr-11">
        <WorkflowIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
        {stats.length === 0 ? null : (
          <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">
            {stats.join(" · ")}
          </span>
        )}
        <span className="rounded-full border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {item.status}
        </span>
      </div>
      {groups.length === 0 ? null : (
        <div className="space-y-1 border-border/60 border-t px-1.5 py-1.5">
          {groups.map((group) => {
            const state = workflowPhaseState(group, isTerminal);
            const doneAgents = group.agents.filter((agent) =>
              TERMINAL_AGENT_STATUSES.has(agent.status),
            ).length;
            return (
              <div
                key={group.key}
                data-v2-workflow-phase={group.index ?? "other"}
                className={cn(
                  "rounded-lg px-2.5 py-2 transition-colors duration-200",
                  state === "active" && "bg-blue-500/5",
                )}
              >
                <div
                  className="flex min-w-0 items-center gap-2.5"
                  {...(group.detail === null ? {} : { title: group.detail })}
                >
                  <PhaseChip state={state} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px] leading-snug",
                      state === "active"
                        ? "text-foreground/90"
                        : state === "pending"
                          ? "text-muted-foreground/70"
                          : "text-foreground/82",
                    )}
                  >
                    {group.title}
                  </span>
                  {group.agents.length === 0 ? null : (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {doneAgents}/{group.agents.length}
                    </span>
                  )}
                </div>
                {group.agents.length === 0 ? null : (
                  <div className="mt-1 space-y-0.5 pl-7.5">
                    {group.agents.map((agent) => (
                      <div
                        key={agent.index}
                        data-v2-workflow-agent={agent.index}
                        data-v2-workflow-agent-status={agent.status}
                        className="flex min-w-0 items-center gap-2"
                        {...(agent.promptPreview === undefined
                          ? {}
                          : { title: agent.promptPreview })}
                      >
                        <AgentStatusIcon status={agent.status} />
                        <span className="min-w-0 shrink-0 truncate text-xs text-foreground/82">
                          {agent.label}
                        </span>
                        {agent.resultPreview === undefined ? null : (
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/70">
                            {agent.resultPreview}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 pl-3 font-mono text-[10px] text-muted-foreground">
                          {agentStats(agent)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isTerminal || item.progress === undefined || item.progress.trim().length === 0 ? null : (
        <div
          data-v2-workflow-progress="true"
          className="flex min-w-0 items-center gap-2 border-border/60 border-t px-3 py-1.5"
        >
          <LoaderIcon className="size-3 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <span className="min-w-0 truncate text-xs text-muted-foreground">{item.progress}</span>
        </div>
      )}
      {result === null || !isTerminal ? null : (
        <details
          className="group border-border/60 border-t"
          data-v2-workflow-result-disclosure="true"
        >
          <summary
            aria-label={`Show result for ${item.workflowName}`}
            className="flex min-w-0 cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden"
          >
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{result}</span>
            <ChevronDownIcon
              className="size-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-border/60 border-t px-3 py-2" data-v2-workflow-result="true">
            <p className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
              {result}
            </p>
          </div>
        </details>
      )}
      {childThreadId === null ? null : (
        <button
          type="button"
          aria-label={`Open ${item.workflowName}`}
          onClick={() => props.onOpenThread(childThreadId)}
          className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLinkIcon className="size-3" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
