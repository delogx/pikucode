import { assert } from "@effect/vitest";
import type { ProviderReplayTranscript } from "@piku/contracts";

import type { OrchestratorV2ScenarioResult } from "../../OrchestratorScenario.ts";
import {
  assertAssistantTextIncludes,
  assertBaseProjection,
  assertExecutionNodeKinds,
  assertSemanticProjectionIntegrity,
  assertTurnItemTypes,
  assertUserMessagesInclude,
  assertVisibleTurnItemsMirrorLocalTurnItems,
  CLAUDE_TODO_LIST_PROMPT,
  projectionFor,
} from "../shared.ts";

export function assertClaudeTodoListOutput(
  result: OrchestratorV2ScenarioResult,
  transcript: ProviderReplayTranscript,
) {
  assertBaseProjection({ result, transcript, runCount: 1, runStatuses: ["completed"] });

  const projection = projectionFor(result, transcript.scenario);
  assertSemanticProjectionIntegrity(projection);
  assertVisibleTurnItemsMirrorLocalTurnItems(projection);
  assertExecutionNodeKinds(projection, ["root_turn", "todo_list", "tool_call"]);
  assertTurnItemTypes(projection, ["user_message", "todo_list", "dynamic_tool"]);
  assertUserMessagesInclude(projection, [CLAUDE_TODO_LIST_PROMPT]);
  assertAssistantTextIncludes(projection, "claude todo list fixture complete");

  // Claude's task tools shape one live list, not a tool row per call.
  const todoListItems = projection.turnItems.filter((item) => item.type === "todo_list");
  assert.lengthOf(todoListItems, 1);
  const taskToolItems = projection.turnItems.filter(
    (item) => item.type === "dynamic_tool" && (item.toolName ?? "").startsWith("Task"),
  );
  assert.deepEqual(taskToolItems, []);

  const todoLists = projection.plans.filter((plan) => plan.kind === "todo_list");
  assert.lengthOf(todoLists, 1);
  assert.deepEqual(
    todoLists.at(-1)?.steps.map((step) => ({ text: step.text, status: step.status })),
    [
      { text: "Read package.json", status: "completed" },
      { text: "Read tsconfig.json", status: "completed" },
      { text: "Report completion", status: "completed" },
    ],
  );
  assert.equal(todoLists.at(-1)?.status, "completed");
}
