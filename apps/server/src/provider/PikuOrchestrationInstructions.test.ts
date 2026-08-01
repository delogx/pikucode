import { assert, describe, it } from "@effect/vitest";

import {
  PIKU_CODE_ORCHESTRATION_INSTRUCTIONS,
  pikuOrchestrationPromptForFirstRun,
  pikuOrchestrationSystemPrompt,
} from "./PikuOrchestrationInstructions.ts";

describe("Piku orchestration provider instructions", () => {
  it("distinguishes delegated subagents from ordinary top-level threads", () => {
    assert.include(PIKU_CODE_ORCHESTRATION_INSTRUCTIONS, "use `delegate_task`");
    assert.include(PIKU_CODE_ORCHESTRATION_INSTRUCTIONS, "ordinary top-level Piku conversations");
    assert.include(PIKU_CODE_ORCHESTRATION_INSTRUCTIONS, "Never use them merely");
    assert.include(PIKU_CODE_ORCHESTRATION_INSTRUCTIONS, "different provider");
  });

  it("documents structured schedules instead of JSON strings", () => {
    assert.include(PIKU_CODE_ORCHESTRATION_INSTRUCTIONS, "structured object, never as JSON text");
    assert.include(PIKU_CODE_ORCHESTRATION_INSTRUCTIONS, '"everyMs":3600000');
    assert.include(PIKU_CODE_ORCHESTRATION_INSTRUCTIONS, "bindToCurrentThread=false");
  });

  it("injects prompt fallback only for an MCP-enabled first run", () => {
    const prompt = "Inspect the repository.";
    const injected = pikuOrchestrationPromptForFirstRun({
      prompt,
      runOrdinal: 1,
      hasPikuMcp: true,
    });

    assert.include(injected, "<piku_code_orchestration_instructions>");
    assert.include(injected, `<user_request>\n${prompt}\n</user_request>`);
    assert.equal(
      pikuOrchestrationPromptForFirstRun({ prompt, runOrdinal: 2, hasPikuMcp: true }),
      prompt,
    );
    assert.equal(
      pikuOrchestrationPromptForFirstRun({ prompt, runOrdinal: 1, hasPikuMcp: false }),
      prompt,
    );
  });

  it("only exposes the system prompt when the Piku MCP server is attached", () => {
    assert.equal(pikuOrchestrationSystemPrompt(false), undefined);
    assert.equal(pikuOrchestrationSystemPrompt(true), PIKU_CODE_ORCHESTRATION_INSTRUCTIONS);
  });
});
