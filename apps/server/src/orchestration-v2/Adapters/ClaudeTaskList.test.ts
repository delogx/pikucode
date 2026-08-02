import { assert, describe, it } from "@effect/vitest";

import {
  applyClaudeTaskListTool,
  type ClaudeTask,
  claudeTaskListSteps,
  claudeTaskListToolKind,
} from "./ClaudeTaskList.ts";

function tasks(): Map<string, ClaudeTask> {
  return new Map<string, ClaudeTask>();
}

function create(
  state: Map<string, ClaudeTask>,
  input: { readonly id: string; readonly subject: string },
): boolean {
  return applyClaudeTaskListTool({
    tasks: state,
    kind: "create",
    toolInput: { subject: input.subject, description: `${input.subject} description` },
    toolOutput: { task: { id: input.id, subject: input.subject } },
  });
}

function update(
  state: Map<string, ClaudeTask>,
  input: {
    readonly id: string;
    readonly status: string;
    readonly from?: string;
    readonly success?: boolean;
  },
): boolean {
  return applyClaudeTaskListTool({
    tasks: state,
    kind: "update",
    toolInput: { taskId: input.id, status: input.status },
    toolOutput: {
      success: input.success ?? true,
      taskId: input.id,
      updatedFields: ["status"],
      ...(input.from === undefined ? {} : { statusChange: { from: input.from, to: input.status } }),
    },
  });
}

describe("claudeTaskListToolKind", () => {
  it("classifies the list-shaping task tools", () => {
    assert.equal(claudeTaskListToolKind("taskcreate"), "create");
    assert.equal(claudeTaskListToolKind("taskupdate"), "update");
    assert.equal(claudeTaskListToolKind("tasklist"), "list");
    assert.equal(claudeTaskListToolKind("taskget"), "get");
    assert.equal(claudeTaskListToolKind("todowrite"), "todo_write");
  });

  it("leaves background-task tools and everything else alone", () => {
    assert.isUndefined(claudeTaskListToolKind("taskoutput"));
    assert.isUndefined(claudeTaskListToolKind("taskstop"));
    assert.isUndefined(claudeTaskListToolKind("task"));
    assert.isUndefined(claudeTaskListToolKind("bash"));
  });
});

describe("applyClaudeTaskListTool", () => {
  it("builds the list in creation order and tracks status changes", () => {
    const state = tasks();
    assert.isTrue(create(state, { id: "1", subject: "Read package.json" }));
    assert.isTrue(create(state, { id: "2", subject: "Read tsconfig.json" }));
    assert.isTrue(update(state, { id: "1", status: "in_progress", from: "pending" }));
    assert.isTrue(update(state, { id: "1", status: "completed", from: "in_progress" }));

    assert.deepEqual(claudeTaskListSteps(state.values()), [
      { id: "1", text: "Read package.json", status: "completed" },
      { id: "2", text: "Read tsconfig.json", status: "pending" },
    ]);
  });

  it("reports no change when a call tells us nothing new", () => {
    const state = tasks();
    create(state, { id: "1", subject: "Ship it" });
    assert.isFalse(update(state, { id: "1", status: "pending", from: "pending" }));
    assert.isFalse(
      applyClaudeTaskListTool({
        tasks: state,
        kind: "get",
        toolInput: { taskId: "1" },
        toolOutput: { task: { id: "1", subject: "Ship it", status: "pending" } },
      }),
    );
  });

  it("ignores an update the runtime rejected", () => {
    const state = tasks();
    create(state, { id: "1", subject: "Ship it" });
    assert.isFalse(update(state, { id: "9", status: "completed", success: false }));
    assert.deepEqual(claudeTaskListSteps(state.values()), [
      { id: "1", text: "Ship it", status: "pending" },
    ]);
  });

  it("drops a deleted task", () => {
    const state = tasks();
    create(state, { id: "1", subject: "Keep" });
    create(state, { id: "2", subject: "Drop" });
    assert.isTrue(
      applyClaudeTaskListTool({
        tasks: state,
        kind: "update",
        toolInput: { taskId: "2", status: "deleted" },
        toolOutput: { success: true, taskId: "2", updatedFields: ["status"] },
      }),
    );
    assert.deepEqual(claudeTaskListSteps(state.values()), [
      { id: "1", text: "Keep", status: "pending" },
    ]);
  });

  it("lets a TaskList snapshot replace what the deltas built up", () => {
    const state = tasks();
    create(state, { id: "1", subject: "Stale" });
    assert.isTrue(
      applyClaudeTaskListTool({
        tasks: state,
        kind: "list",
        toolInput: {},
        toolOutput: {
          tasks: [
            { id: "2", subject: "Fresh first", status: "completed", blockedBy: [] },
            { id: "1", subject: "Fresh second", status: "in_progress", blockedBy: [] },
          ],
        },
      }),
    );
    assert.deepEqual(claudeTaskListSteps(state.values()), [
      { id: "2", text: "Fresh first", status: "completed" },
      { id: "1", text: "Fresh second", status: "running" },
    ]);
  });

  it("folds a TodoWrite snapshot into the same list", () => {
    const state = tasks();
    assert.isTrue(
      applyClaudeTaskListTool({
        tasks: state,
        kind: "todo_write",
        toolInput: {
          todos: [
            { content: "Inspect", status: "completed", activeForm: "Inspecting" },
            { content: "Report", status: "in_progress", activeForm: "Reporting" },
            { status: "pending", activeForm: "Waiting" },
          ],
        },
        toolOutput: undefined,
      }),
    );
    assert.deepEqual(claudeTaskListSteps(state.values()), [
      { id: "todo-1", text: "Inspect", status: "completed" },
      { id: "todo-2", text: "Report", status: "running" },
      { id: "todo-3", text: "Waiting", status: "pending" },
    ]);
  });

  it("keeps a placeholder label when a task arrives without a subject", () => {
    const state = tasks();
    assert.isTrue(
      applyClaudeTaskListTool({
        tasks: state,
        kind: "create",
        toolInput: {},
        toolOutput: { task: { id: 7 } },
      }),
    );
    assert.deepEqual(claudeTaskListSteps(state.values()), [
      { id: "7", text: "Task 7", status: "pending" },
    ]);
  });

  it("ignores payloads that carry no task identity", () => {
    const state = tasks();
    assert.isFalse(
      applyClaudeTaskListTool({
        tasks: state,
        kind: "create",
        toolInput: { subject: "No id" },
        toolOutput: {},
      }),
    );
    assert.isFalse(
      applyClaudeTaskListTool({
        tasks: state,
        kind: "list",
        toolInput: {},
        toolOutput: { tasks: "not-an-array" },
      }),
    );
    assert.deepEqual(claudeTaskListSteps(state.values()), []);
  });
});
