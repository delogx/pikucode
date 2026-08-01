import type {
  OrchestrationV2WorkflowAgent,
  OrchestrationV2WorkflowAgentStatus,
  OrchestrationV2WorkflowPhase,
} from "@piku/contracts";

/**
 * Claude's dynamic-workflow runs stream their live state through
 * `task_progress` messages carrying a `workflow_progress` array (one
 * `workflow_phase` entry per declared phase, one `workflow_agent` entry per
 * spawned agent). The field is not part of the SDK's published message types
 * yet, so everything here parses defensively from `unknown`.
 */
export interface ClaudeWorkflowProgressSnapshot {
  readonly phases: ReadonlyArray<OrchestrationV2WorkflowPhase>;
  readonly agents: ReadonlyArray<OrchestrationV2WorkflowAgent>;
}

export interface ClaudeWorkflowUsage {
  readonly totalTokens?: number;
  readonly toolUses?: number;
  readonly durationMs?: number;
}

function stringField(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  return typeof field === "string" && field.trim().length > 0 ? field : null;
}

function countField(value: Record<string, unknown>, key: string): number | null {
  const field = value[key];
  return typeof field === "number" && Number.isInteger(field) && field >= 0 ? field : null;
}

function indexField(value: Record<string, unknown>, key: string): number | null {
  const field = value[key];
  return typeof field === "number" && Number.isInteger(field) && field >= 1 ? field : null;
}

/**
 * Wire states observed from the workflow runtime: `queued`, `start`, `retry`,
 * `done`, `error`, plus stop-ish states for killed runs. Unknown states map to
 * `running` so a new CLI vocabulary never wedges an agent row in `queued`.
 */
export function claudeWorkflowAgentStatusFromState(
  state: string,
): OrchestrationV2WorkflowAgentStatus {
  switch (state) {
    case "queued":
      return "queued";
    case "done":
      return "completed";
    case "error":
    case "failed":
      return "failed";
    case "cancelled":
    case "killed":
    case "skipped":
    case "stopped":
      return "cancelled";
    default:
      return "running";
  }
}

export function parseClaudeWorkflowProgress(value: unknown): ClaudeWorkflowProgressSnapshot | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const phases: Array<OrchestrationV2WorkflowPhase> = [];
  const agents: Array<OrchestrationV2WorkflowAgent> = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (record["type"] === "workflow_phase") {
      const index = indexField(record, "index");
      const title = stringField(record, "title");
      if (index === null || title === null) {
        continue;
      }
      phases.push({ index, title: title.trim() });
      continue;
    }
    if (record["type"] === "workflow_agent") {
      const index = indexField(record, "index");
      if (index === null) {
        continue;
      }
      const label = stringField(record, "label")?.trim() ?? `Agent ${index}`;
      const state = stringField(record, "state") ?? "running";
      const promptPreview = stringField(record, "promptPreview");
      const resultPreview = stringField(record, "resultPreview");
      const totalTokens = countField(record, "tokens");
      const toolUses = countField(record, "toolCalls");
      const durationMs = countField(record, "durationMs");
      agents.push({
        index,
        label,
        phaseIndex: indexField(record, "phaseIndex"),
        phaseTitle: stringField(record, "phaseTitle"),
        model: stringField(record, "model"),
        status: claudeWorkflowAgentStatusFromState(state),
        ...(promptPreview === null ? {} : { promptPreview }),
        ...(resultPreview === null ? {} : { resultPreview }),
        ...(totalTokens === null ? {} : { totalTokens }),
        ...(toolUses === null ? {} : { toolUses }),
        ...(durationMs === null ? {} : { durationMs }),
      });
    }
  }
  if (phases.length === 0 && agents.length === 0) {
    return null;
  }
  return { phases, agents };
}

export function parseClaudeWorkflowUsage(value: unknown): ClaudeWorkflowUsage | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const totalTokens = countField(record, "total_tokens");
  const toolUses = countField(record, "tool_uses");
  const durationMs = countField(record, "duration_ms");
  if (totalTokens === null && toolUses === null && durationMs === null) {
    return null;
  }
  return {
    ...(totalTokens === null ? {} : { totalTokens }),
    ...(toolUses === null ? {} : { toolUses }),
    ...(durationMs === null ? {} : { durationMs }),
  };
}

/**
 * Skips over a quoted string starting at `start` (which must point at the
 * opening quote); returns the index just past the closing quote.
 */
function skipString(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    const char = text[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) {
      return index + 1;
    }
    index += 1;
  }
  return index;
}

/**
 * Returns the index just past the delimiter that closes the one opening at
 * `start`, skipping strings and comments; `null` when unbalanced.
 */
function matchDelimiter(text: string, start: number): number | null {
  const open = text[start];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (close === null) {
    return null;
  }
  let depth = 0;
  let index = start;
  while (index < text.length) {
    const char = text[index];
    if (char === '"' || char === "'" || char === "`") {
      index = skipString(text, index);
      continue;
    }
    if (char === "/" && text[index + 1] === "/") {
      const lineEnd = text.indexOf("\n", index);
      index = lineEnd === -1 ? text.length : lineEnd + 1;
      continue;
    }
    if (char === "/" && text[index + 1] === "*") {
      const blockEnd = text.indexOf("*/", index + 2);
      index = blockEnd === -1 ? text.length : blockEnd + 2;
      continue;
    }
    if (char === open || char === close) {
      depth += char === open ? 1 : -1;
      if (depth === 0) {
        return index + 1;
      }
    }
    index += 1;
  }
  return null;
}

/** Removes `//` and `/* *​/` comments while leaving string contents intact. */
function stripComments(text: string): string {
  let result = "";
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '"' || char === "'" || char === "`") {
      const end = skipString(text, index);
      result += text.slice(index, end);
      index = end;
      continue;
    }
    if (char === "/" && text[index + 1] === "/") {
      const lineEnd = text.indexOf("\n", index);
      index = lineEnd === -1 ? text.length : lineEnd;
      continue;
    }
    if (char === "/" && text[index + 1] === "*") {
      const blockEnd = text.indexOf("*/", index + 2);
      index = blockEnd === -1 ? text.length : blockEnd + 2;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
}

function quotedStringProperty(objectText: string, key: string): string | null {
  const match = new RegExp(
    `(?:^|[,{\\s])${key}\\s*:\\s*(["'\`])((?:\\\\.|(?!\\1).)*)\\1`,
    "u",
  ).exec(objectText);
  if (match?.[2] === undefined) {
    return null;
  }
  const value = match[2]
    .replaceAll(String.raw`\'`, "'")
    .replaceAll(String.raw`\"`, '"')
    .replaceAll("\\`", "`")
    .replaceAll(String.raw`\\`, "\\")
    .trim();
  return value.length > 0 ? value : null;
}

/**
 * Extracts `meta.phases` from a workflow script's leading
 * `export const meta = {...}` literal. The meta block is a pure literal by the
 * Workflow tool's contract, so a tolerant textual scan recovers the declared
 * phases (including `detail`, which the runtime's live progress entries do
 * not carry) without executing the script. Returns `[]` whenever the shape is
 * unexpected.
 */
export function parseClaudeWorkflowMetaPhases(
  script: string,
): ReadonlyArray<{ readonly title: string; readonly detail?: string }> {
  const metaStart = script.search(/export\s+const\s+meta\s*=\s*\{/u);
  if (metaStart === -1) {
    return [];
  }
  const braceStart = script.indexOf("{", metaStart);
  const metaEnd = matchDelimiter(script, braceStart);
  if (metaEnd === null) {
    return [];
  }
  const metaText = script.slice(braceStart, metaEnd);
  const phasesMatch = /phases\s*:\s*\[/u.exec(metaText);
  if (phasesMatch === null) {
    return [];
  }
  const bracketStart = phasesMatch.index + phasesMatch[0].length - 1;
  const bracketEnd = matchDelimiter(metaText, bracketStart);
  if (bracketEnd === null) {
    return [];
  }
  const phasesText = stripComments(metaText.slice(bracketStart + 1, bracketEnd - 1));
  const phases: Array<{ readonly title: string; readonly detail?: string }> = [];
  let cursor = 0;
  while (cursor < phasesText.length) {
    const objectStart = phasesText.indexOf("{", cursor);
    if (objectStart === -1) {
      break;
    }
    const objectEnd = matchDelimiter(phasesText, objectStart);
    if (objectEnd === null) {
      break;
    }
    const objectText = phasesText.slice(objectStart, objectEnd);
    const title = quotedStringProperty(objectText, "title");
    if (title !== null) {
      const detail = quotedStringProperty(objectText, "detail");
      phases.push({ title, ...(detail === null ? {} : { detail }) });
    }
    cursor = objectEnd;
  }
  return phases;
}

/**
 * Live workflow phases come from the runtime's progress entries once agents
 * start; until then (and for the `detail` text always) the script's meta
 * block is the source. Wire entries win on title so a renamed phase tracks
 * the runtime, while matching indexes inherit the meta detail.
 */
export function mergeClaudeWorkflowPhases(input: {
  readonly metaPhases: ReadonlyArray<{ readonly title: string; readonly detail?: string }>;
  readonly wirePhases: ReadonlyArray<OrchestrationV2WorkflowPhase>;
}): ReadonlyArray<OrchestrationV2WorkflowPhase> {
  if (input.wirePhases.length === 0) {
    return input.metaPhases.map((phase, index) => ({
      index: index + 1,
      title: phase.title,
      ...(phase.detail === undefined ? {} : { detail: phase.detail }),
    }));
  }
  return input.wirePhases.map((phase) => {
    const metaPhase = input.metaPhases[phase.index - 1];
    return metaPhase?.detail === undefined ? phase : { ...phase, detail: metaPhase.detail };
  });
}
