import { CLAUDE_TODO_LIST_PROMPT, type OrchestratorFixtureInput } from "../shared.ts";

export function claudeTodoListInput(): OrchestratorFixtureInput {
  return {
    steps: [{ type: "message", text: CLAUDE_TODO_LIST_PROMPT }],
  };
}
