import type { OrchestrationV2PlanStep } from "@piku/contracts";

/**
 * Claude keeps its own list of the work it plans to do. Today it maintains that
 * list through the task tools: `TaskCreate` adds an entry, `TaskUpdate` moves
 * one through pending -> in_progress -> completed (or deletes it), and
 * `TaskList`/`TaskGet` answer with the authoritative snapshot. Older builds send
 * the whole list at once as a `TodoWrite` snapshot instead.
 *
 * Every one of those shapes folds into the ordered list here, which the adapter
 * projects as a todo-list plan artifact so the app can show Claude's tasks the
 * same way it shows a provider with a native plan protocol.
 */
export interface ClaudeTask {
  readonly id: string;
  readonly text: string;
  readonly status: OrchestrationV2PlanStep["status"];
}

export type ClaudeTaskListToolKind = "create" | "update" | "list" | "get" | "todo_write";

const CLAUDE_TASK_LIST_TOOL_KINDS: Record<string, ClaudeTaskListToolKind> = {
  taskcreate: "create",
  taskupdate: "update",
  tasklist: "list",
  taskget: "get",
  todowrite: "todo_write",
};

/**
 * Classifies a normalized tool name (lowercase, separators stripped) as one of
 * the task-list tools. `TaskOutput` and `TaskStop` are absent on purpose: they
 * act on background tasks, not on the task list.
 */
export function claudeTaskListToolKind(
  normalizedToolName: string,
): ClaudeTaskListToolKind | undefined {
  return CLAUDE_TASK_LIST_TOOL_KINDS[normalizedToolName];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function trimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function taskId(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : trimmedString(value);
}

function taskStatus(value: unknown): ClaudeTask["status"] | undefined {
  switch (value) {
    case "completed":
      return "completed";
    case "in_progress":
      return "running";
    case "pending":
      return "pending";
    default:
      return undefined;
  }
}

function upsert(
  tasks: Map<string, ClaudeTask>,
  task: { readonly id: string; readonly text?: string; readonly status?: ClaudeTask["status"] },
): boolean {
  const previous = tasks.get(task.id);
  const next: ClaudeTask = {
    id: task.id,
    text: task.text ?? previous?.text ?? `Task ${task.id}`,
    status: task.status ?? previous?.status ?? "pending",
  };
  if (previous !== undefined && previous.text === next.text && previous.status === next.status) {
    return false;
  }
  tasks.set(task.id, next);
  return true;
}

function applyCreate(
  tasks: Map<string, ClaudeTask>,
  input: Record<string, unknown> | undefined,
  output: Record<string, unknown> | undefined,
): boolean {
  const created = asRecord(output?.["task"]);
  const id = taskId(created?.["id"]);
  if (id === undefined) {
    return false;
  }
  const text = trimmedString(created?.["subject"]) ?? trimmedString(input?.["subject"]);
  return upsert(tasks, { id, ...(text === undefined ? {} : { text }), status: "pending" });
}

function applyUpdate(
  tasks: Map<string, ClaudeTask>,
  input: Record<string, unknown> | undefined,
  output: Record<string, unknown> | undefined,
): boolean {
  if (output?.["success"] === false) {
    return false;
  }
  const id = taskId(output?.["taskId"]) ?? taskId(input?.["taskId"]);
  if (id === undefined) {
    return false;
  }
  // A deletion only reaches the list when the tool confirms it ran, which the
  // `success === false` guard above already established.
  if (input?.["status"] === "deleted") {
    return tasks.delete(id);
  }
  const status =
    taskStatus(asRecord(output?.["statusChange"])?.["to"]) ?? taskStatus(input?.["status"]);
  const text = trimmedString(input?.["subject"]);
  return upsert(tasks, {
    id,
    ...(text === undefined ? {} : { text }),
    ...(status === undefined ? {} : { status }),
  });
}

// `TaskList`/`TaskGet` answer with the runtime's own view, so a snapshot wins
// over whatever the incremental events built up.
function applySnapshot(
  tasks: Map<string, ClaudeTask>,
  snapshot: ReadonlyArray<{
    readonly id: string;
    readonly text?: string;
    readonly status?: ClaudeTask["status"];
  }>,
): boolean {
  const previous = [...tasks.values()];
  tasks.clear();
  for (const entry of snapshot) {
    tasks.set(entry.id, {
      id: entry.id,
      text: entry.text ?? `Task ${entry.id}`,
      status: entry.status ?? "pending",
    });
  }
  const next = [...tasks.values()];
  return (
    previous.length !== next.length ||
    next.some(
      (task, index) =>
        previous[index]?.id !== task.id ||
        previous[index]?.text !== task.text ||
        previous[index]?.status !== task.status,
    )
  );
}

function applyList(
  tasks: Map<string, ClaudeTask>,
  output: Record<string, unknown> | undefined,
): boolean {
  const listed = output?.["tasks"];
  if (!Array.isArray(listed)) {
    return false;
  }
  return applySnapshot(
    tasks,
    listed.flatMap((entry) => {
      const record = asRecord(entry);
      const id = taskId(record?.["id"]);
      if (id === undefined) {
        return [];
      }
      const text = trimmedString(record?.["subject"]);
      const status = taskStatus(record?.["status"]);
      return [
        {
          id,
          ...(text === undefined ? {} : { text }),
          ...(status === undefined ? {} : { status }),
        },
      ];
    }),
  );
}

function applyGet(
  tasks: Map<string, ClaudeTask>,
  output: Record<string, unknown> | undefined,
): boolean {
  const task = asRecord(output?.["task"]);
  const id = taskId(task?.["id"]);
  if (id === undefined) {
    return false;
  }
  const text = trimmedString(task?.["subject"]);
  const status = taskStatus(task?.["status"]);
  return upsert(tasks, {
    id,
    ...(text === undefined ? {} : { text }),
    ...(status === undefined ? {} : { status }),
  });
}

// `TodoWrite` carries the entire list as its input, with no ids of its own.
function applyTodoWrite(
  tasks: Map<string, ClaudeTask>,
  input: Record<string, unknown> | undefined,
): boolean {
  const todos = input?.["todos"];
  if (!Array.isArray(todos)) {
    return false;
  }
  return applySnapshot(
    tasks,
    todos.flatMap((entry, index) => {
      const record = asRecord(entry);
      if (record === undefined) {
        return [];
      }
      const text = trimmedString(record["content"]) ?? trimmedString(record["activeForm"]);
      const status = taskStatus(record["status"]);
      return [
        {
          id: `todo-${index + 1}`,
          ...(text === undefined ? {} : { text }),
          ...(status === undefined ? {} : { status }),
        },
      ];
    }),
  );
}

/**
 * Folds one task-tool call into `tasks`, which keeps Claude's tasks in the order
 * they were added. Returns whether the list actually changed, so a read that
 * tells us nothing new does not re-emit the plan artifact.
 */
export function applyClaudeTaskListTool(input: {
  readonly tasks: Map<string, ClaudeTask>;
  readonly kind: ClaudeTaskListToolKind;
  readonly toolInput: unknown;
  readonly toolOutput: unknown;
}): boolean {
  const toolInput = asRecord(input.toolInput);
  const toolOutput = asRecord(input.toolOutput);
  switch (input.kind) {
    case "create":
      return applyCreate(input.tasks, toolInput, toolOutput);
    case "update":
      return applyUpdate(input.tasks, toolInput, toolOutput);
    case "list":
      return applyList(input.tasks, toolOutput);
    case "get":
      return applyGet(input.tasks, toolOutput);
    case "todo_write":
      return applyTodoWrite(input.tasks, toolInput);
  }
}

export function claudeTaskListSteps(
  tasks: Iterable<ClaudeTask>,
): ReadonlyArray<OrchestrationV2PlanStep> {
  return [...tasks].map((task) => ({ id: task.id, text: task.text, status: task.status }));
}
