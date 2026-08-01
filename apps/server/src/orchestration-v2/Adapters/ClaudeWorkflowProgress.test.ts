import { assert, describe, it } from "@effect/vitest";

import {
  claudeWorkflowAgentStatusFromState,
  mergeClaudeWorkflowPhases,
  parseClaudeWorkflowMetaPhases,
  parseClaudeWorkflowProgress,
  parseClaudeWorkflowUsage,
} from "./ClaudeWorkflowProgress.ts";

const DEMO_SCRIPT = `export const meta = {
  name: 'capture-demo',
  description: 'Tiny two-phase demo workflow for protocol capture',
  phases: [
    { title: 'Gather', detail: 'two trivial questions' },
    { title: 'Summarize', detail: 'combine answers' },
  ],
}
phase('Gather')
const facts = await parallel([
  () => agent('Reply with exactly the word "blue". Nothing else.', {label: 'Color', phase: 'Gather'}),
])
`;

describe("parseClaudeWorkflowMetaPhases", () => {
  it("extracts titles and details from the meta literal", () => {
    assert.deepStrictEqual(parseClaudeWorkflowMetaPhases(DEMO_SCRIPT), [
      { title: "Gather", detail: "two trivial questions" },
      { title: "Summarize", detail: "combine answers" },
    ]);
  });

  it("handles double quotes, escapes, comments, and missing detail", () => {
    const script = `export const meta = {
  name: "x",
  // phases below use mixed quoting
  phases: [
    { title: "Fix \\"gate\\"" },
    /* block comment { title: 'not-a-phase' } */
    { detail: 'reversed order', title: 'Verify' },
  ],
}
return null
`;
    assert.deepStrictEqual(parseClaudeWorkflowMetaPhases(script), [
      { title: 'Fix "gate"' },
      { title: "Verify", detail: "reversed order" },
    ]);
  });

  it("ignores phase-shaped objects outside the meta block", () => {
    const script = `export const meta = { name: 'no-phases', description: 'd' }
const other = { phases: [{ title: 'Not real' }] }
`;
    assert.deepStrictEqual(parseClaudeWorkflowMetaPhases(script), []);
  });

  it("returns empty for scripts without a meta literal", () => {
    assert.deepStrictEqual(parseClaudeWorkflowMetaPhases("phase('x')"), []);
  });

  it("returns empty for an unbalanced meta literal", () => {
    assert.deepStrictEqual(
      parseClaudeWorkflowMetaPhases("export const meta = { phases: [ { title: 'x'"),
      [],
    );
  });
});

describe("parseClaudeWorkflowProgress", () => {
  it("parses phase and agent entries from a wire snapshot", () => {
    const snapshot = parseClaudeWorkflowProgress([
      { type: "workflow_phase", index: 1, title: "Gather" },
      { type: "workflow_phase", index: 2, title: "Summarize" },
      {
        type: "workflow_agent",
        index: 1,
        label: "Color",
        phaseIndex: 1,
        phaseTitle: "Gather",
        agentId: "a52d2271990893039",
        model: "claude-haiku-4-5-20251001",
        state: "done",
        startedAt: 1785596516122,
        attempt: 1,
        promptPreview: 'Reply with exactly the word "blue". Nothing else.',
        tokens: 9072,
        toolCalls: 0,
        durationMs: 1283,
        resultPreview: "blue",
      },
      {
        type: "workflow_agent",
        index: 2,
        label: "Number",
        phaseIndex: 1,
        phaseTitle: "Gather",
        model: "claude-haiku-4-5-20251001",
        state: "start",
      },
    ]);
    assert.deepStrictEqual(snapshot, {
      phases: [
        { index: 1, title: "Gather" },
        { index: 2, title: "Summarize" },
      ],
      agents: [
        {
          index: 1,
          label: "Color",
          phaseIndex: 1,
          phaseTitle: "Gather",
          model: "claude-haiku-4-5-20251001",
          status: "completed",
          promptPreview: 'Reply with exactly the word "blue". Nothing else.',
          resultPreview: "blue",
          totalTokens: 9072,
          toolUses: 0,
          durationMs: 1283,
        },
        {
          index: 2,
          label: "Number",
          phaseIndex: 1,
          phaseTitle: "Gather",
          model: "claude-haiku-4-5-20251001",
          status: "running",
        },
      ],
    });
  });

  it("tolerates malformed entries and unknown states", () => {
    const snapshot = parseClaudeWorkflowProgress([
      null,
      "junk",
      { type: "workflow_phase", index: 0, title: "bad index" },
      { type: "workflow_phase", index: 1 },
      { type: "workflow_agent", index: 3, state: "hyperdrive" },
      { type: "something_else", index: 1 },
    ]);
    assert.deepStrictEqual(snapshot, {
      phases: [],
      agents: [
        {
          index: 3,
          label: "Agent 3",
          phaseIndex: null,
          phaseTitle: null,
          model: null,
          status: "running",
        },
      ],
    });
  });

  it("returns null when nothing workflow-shaped is present", () => {
    assert.strictEqual(parseClaudeWorkflowProgress([{ type: "other" }]), null);
    assert.strictEqual(parseClaudeWorkflowProgress("not an array"), null);
    assert.strictEqual(parseClaudeWorkflowProgress([]), null);
  });
});

describe("claudeWorkflowAgentStatusFromState", () => {
  it("maps the observed wire vocabulary", () => {
    assert.strictEqual(claudeWorkflowAgentStatusFromState("queued"), "queued");
    assert.strictEqual(claudeWorkflowAgentStatusFromState("start"), "running");
    assert.strictEqual(claudeWorkflowAgentStatusFromState("retry"), "running");
    assert.strictEqual(claudeWorkflowAgentStatusFromState("done"), "completed");
    assert.strictEqual(claudeWorkflowAgentStatusFromState("error"), "failed");
    assert.strictEqual(claudeWorkflowAgentStatusFromState("killed"), "cancelled");
    assert.strictEqual(claudeWorkflowAgentStatusFromState("skipped"), "cancelled");
  });
});

describe("parseClaudeWorkflowUsage", () => {
  it("reads the task_progress usage payload", () => {
    assert.deepStrictEqual(
      parseClaudeWorkflowUsage({ total_tokens: 27_217, tool_uses: 0, duration_ms: 3_778 }),
      { totalTokens: 27_217, toolUses: 0, durationMs: 3_778 },
    );
  });

  it("returns null for empty or malformed payloads", () => {
    assert.strictEqual(parseClaudeWorkflowUsage(null), null);
    assert.strictEqual(parseClaudeWorkflowUsage({}), null);
    assert.strictEqual(parseClaudeWorkflowUsage({ total_tokens: "many" }), null);
  });
});

describe("mergeClaudeWorkflowPhases", () => {
  it("uses meta phases until wire phases arrive", () => {
    assert.deepStrictEqual(
      mergeClaudeWorkflowPhases({
        metaPhases: [{ title: "Gather", detail: "two trivial questions" }, { title: "Summarize" }],
        wirePhases: [],
      }),
      [
        { index: 1, title: "Gather", detail: "two trivial questions" },
        { index: 2, title: "Summarize" },
      ],
    );
  });

  it("keeps wire titles while inheriting meta detail by index", () => {
    assert.deepStrictEqual(
      mergeClaudeWorkflowPhases({
        metaPhases: [{ title: "Gather", detail: "two trivial questions" }],
        wirePhases: [
          { index: 1, title: "Collect" },
          { index: 2, title: "Extra" },
        ],
      }),
      [
        { index: 1, title: "Collect", detail: "two trivial questions" },
        { index: 2, title: "Extra" },
      ],
    );
  });
});
