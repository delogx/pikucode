export const PIKU_CODE_ORCHESTRATION_INSTRUCTIONS = `

## Piku Code orchestration

The \`piku-code\` MCP server provides app-owned orchestration. Treat these concepts distinctly:

- A delegated task/subagent is child work owned by the current thread. When the user asks for an agent, subagent, worker, delegation, or parallel help, use \`delegate_task\` once per child task. This remains true when targeting a different provider. Use \`orchestrator_capabilities\` to discover provider/model IDs, retain each returned \`taskId\`, and use \`task_status\` or \`task_cancel\` to manage it. The returned \`childThreadId\` is backing storage for the subagent; do not replace delegation with ordinary thread creation.
- \`create_threads\` and \`piku_thread_start\` create ordinary top-level Piku conversations. Use them only when the user explicitly asks for separate/new/top-level threads or conversations. Never use them merely because the user said "subagent" or requested parallel delegated work.
- \`schedule_task\` creates persistent recurring work in the app scheduler. Pass \`schedule\` as a structured object, never as JSON text: \`{"type":"interval","everyMs":3600000}\` for an interval, or \`{"type":"fixed_time","timeOfDay":"09:00","weekdays":[1,2,3,4,5]}\` for a wall-clock schedule. By default runs return to the current thread; set \`bindToCurrentThread=false\` only when the user wants a fresh thread for every run. After scheduling, report the returned cadence and next run time.

Tool names may include an MCP prefix (for example \`mcp__piku-code__delegate_task\`); the semantics are the same. Keep polling/wait loops bounded, do not duplicate active work, and use stable \`clientRequestId\` values when retrying mutations.
`;

/**
 * Providers without a system/developer-instruction channel receive this
 * context in the first prompt. Keep the wrapper explicit so it cannot be
 * mistaken for text authored by the user.
 */
export function prependPikuOrchestrationInstructions(prompt: string): string {
  return `<piku_code_orchestration_instructions>${PIKU_CODE_ORCHESTRATION_INSTRUCTIONS.trim()}</piku_code_orchestration_instructions>\n\n<user_request>\n${prompt}\n</user_request>`;
}

export function pikuOrchestrationPromptForFirstRun(input: {
  readonly prompt: string;
  readonly runOrdinal: number;
  readonly hasPikuMcp: boolean;
}): string {
  return input.runOrdinal === 1 && input.hasPikuMcp
    ? prependPikuOrchestrationInstructions(input.prompt)
    : input.prompt;
}

export function pikuOrchestrationSystemPrompt(hasPikuMcp: boolean): string | undefined {
  return hasPikuMcp ? PIKU_CODE_ORCHESTRATION_INSTRUCTIONS : undefined;
}
