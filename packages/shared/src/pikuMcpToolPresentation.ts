export type PikuMcpToolLogo = "piku-code";

export interface PikuMcpToolPresentation {
  readonly displayName: string;
  readonly logo: PikuMcpToolLogo;
}

const PIKU_MCP_SERVER_ALIASES = new Set(["piku-code", "piku_code", "pikucode"]);

const PIKU_MCP_TOOL_DISPLAY_NAMES: Record<string, string> = {
  orchestrator_capabilities: "Get orchestration capabilities",
  delegate_task: "Delegate a child task",
  task_status: "Get delegated task status",
  task_cancel: "Cancel delegated task",
  schedule_task: "Schedule a recurring task",
  list_scheduled_tasks: "List scheduled tasks",
  update_scheduled_task: "Update a scheduled task",
  delete_scheduled_task: "Delete a scheduled task",
  create_threads: "Create Piku threads",
  piku_thread_start: "Start a Piku thread",
  piku_thread_list: "List Piku threads",
  piku_thread_read: "Read a Piku thread",
  piku_thread_send: "Send to a Piku thread",
  piku_thread_wait: "Wait for a Piku thread",
  piku_thread_interrupt: "Interrupt a Piku thread",
  piku_worktree_handoff: "Hand off thread to a git worktree",
  piku_worktree_status: "Get thread worktree status",
  preview_status: "Get preview browser status",
  preview_open: "Open a page in the preview browser",
  preview_navigate: "Navigate the preview browser",
  preview_snapshot: "Snapshot the preview page",
  preview_click: "Click in the preview browser",
  preview_press: "Press a key in the preview browser",
  preview_type: "Type in the preview browser",
  preview_scroll: "Scroll the preview browser",
  preview_resize: "Resize the preview browser",
  preview_evaluate: "Evaluate script in the preview browser",
  preview_wait_for: "Wait for the preview page",
  preview_set_appearance: "Set preview browser appearance",
  preview_recording_start: "Start recording the preview browser",
  preview_recording_stop: "Stop recording the preview browser",
};

function normalizePikuMcpToolLabel(value: string): string {
  return value.replace(/\s+(?:complete|completed)\s*$/i, "").trim();
}

function resolvePikuMcpToolName(value: string): string | null {
  const label = normalizePikuMcpToolLabel(value);
  const mcpMatch = /^mcp__(?<server>.+?)__(?<tool>.+)$/.exec(label);
  if (mcpMatch?.groups) {
    const { server, tool } = mcpMatch.groups;
    return server !== undefined &&
      tool !== undefined &&
      PIKU_MCP_SERVER_ALIASES.has(server.toLowerCase())
      ? tool
      : null;
  }

  const namespaceMatch = /^(?<server>piku-code|piku_code|pikucode)[.:/](?<tool>.+)$/i.exec(label);
  if (namespaceMatch?.groups) {
    return namespaceMatch.groups.tool ?? null;
  }

  return Object.hasOwn(PIKU_MCP_TOOL_DISPLAY_NAMES, label) ? label : null;
}

export function resolvePikuMcpToolPresentation(
  toolName: string | null | undefined,
): PikuMcpToolPresentation | null {
  const resolvedToolName =
    toolName === undefined || toolName === null ? null : resolvePikuMcpToolName(toolName);
  if (resolvedToolName === null) {
    return null;
  }
  const displayName = PIKU_MCP_TOOL_DISPLAY_NAMES[resolvedToolName];
  if (displayName === undefined) {
    return null;
  }
  return {
    displayName,
    logo: "piku-code",
  };
}
