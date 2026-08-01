import type {
  OrchestrationV2TurnItem,
  OrchestrationV2WorkflowAgent,
  OrchestrationV2WorkflowPhase,
  ThreadId,
} from "@piku/contracts";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
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

function AgentStatusIcon(props: { readonly status: OrchestrationV2WorkflowAgent["status"] }) {
  switch (props.status) {
    case "completed":
      return (
        <CheckIcon
          aria-label="completed"
          className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
        />
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
      return <ClockIcon aria-label="queued" className="size-3 shrink-0 text-muted-foreground/70" />;
  }
}

function PhaseGlyph(props: { readonly state: WorkflowPhaseState; readonly ordinal: number }) {
  if (props.state === "active") {
    return <LoaderIcon aria-hidden="true" className="size-3 shrink-0 animate-spin text-primary" />;
  }
  if (props.state === "done") {
    return (
      <CheckIcon
        aria-hidden="true"
        className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
      />
    );
  }
  if (props.state === "failed") {
    return <XIcon aria-hidden="true" className="size-3 shrink-0 text-destructive" />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-3 shrink-0 items-center justify-center font-mono text-[10px] text-muted-foreground/70"
    >
      {props.ordinal}
    </span>
  );
}

function AgentRow(props: { readonly agent: OrchestrationV2WorkflowAgent }) {
  const { agent } = props;
  const stats = [
    ...(agent.model === null ? [] : [workflowAgentModelLabel(agent.model)]),
    ...(agent.totalTokens === undefined
      ? []
      : [`${formatContextWindowTokens(agent.totalTokens)} tok`]),
    ...(agent.durationMs === undefined ? [] : [formatDuration(agent.durationMs)]),
  ];
  return (
    <div
      data-v2-workflow-agent={agent.index}
      data-v2-workflow-agent-status={agent.status}
      className="flex min-w-0 items-center gap-2 py-0.5 pl-5"
      {...(agent.promptPreview === undefined ? {} : { title: agent.promptPreview })}
    >
      <AgentStatusIcon status={agent.status} />
      <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">{agent.label}</span>
      {agent.resultPreview === undefined || agent.status !== "completed" ? null : (
        <span className="hidden max-w-[35%] truncate text-[11px] text-muted-foreground/80 sm:inline">
          {agent.resultPreview}
        </span>
      )}
      {stats.length === 0 ? null : (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {stats.join(" · ")}
        </span>
      )}
    </div>
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
  return (
    <section
      data-v2-item-type="workflow"
      data-v2-workflow-status={item.status}
      className="relative min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card/30"
    >
      <div className="flex min-w-0 items-center gap-2 px-3 py-2 pr-11">
        <WorkflowIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 truncate font-mono text-xs font-medium">{item.workflowName}</span>
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 font-mono text-[10px]",
            item.status === "failed"
              ? "border-destructive/40 text-destructive"
              : item.status === "completed"
                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "border-border/70 text-muted-foreground",
          )}
        >
          {item.status}
        </span>
        <span className="min-w-0 flex-1" />
        {stats.length === 0 ? null : (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {stats.join(" · ")}
          </span>
        )}
      </div>
      {item.description.trim().length === 0 ? null : (
        <p className="truncate px-3 pb-1.5 text-xs text-muted-foreground">{item.description}</p>
      )}
      {groups.length === 0 ? null : (
        <div className="space-y-1 border-border/60 border-t px-3 py-2">
          {groups.map((group, groupIndex) => {
            const state = workflowPhaseState(group, isTerminal);
            const doneAgents = group.agents.filter((agent) =>
              TERMINAL_AGENT_STATUSES.has(agent.status),
            ).length;
            return (
              <div key={group.key} data-v2-workflow-phase={group.index ?? "other"}>
                <div
                  className="flex min-w-0 items-center gap-2"
                  {...(group.detail === null ? {} : { title: group.detail })}
                >
                  <PhaseGlyph state={state} ordinal={group.index ?? groupIndex + 1} />
                  <span
                    className={cn(
                      "min-w-0 truncate text-xs font-medium",
                      state === "pending" ? "text-muted-foreground" : "text-foreground/90",
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
                {group.agents.map((agent) => (
                  <AgentRow key={agent.index} agent={agent} />
                ))}
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
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary"
          />
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {item.progress}
          </span>
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
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {result}
            </span>
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
