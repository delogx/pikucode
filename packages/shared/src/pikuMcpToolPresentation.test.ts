import { describe, expect, it } from "vite-plus/test";

import { resolvePikuMcpToolPresentation } from "./pikuMcpToolPresentation.ts";

describe("resolvePikuMcpToolPresentation", () => {
  it("pretty prints Claude and Cursor Piku MCP tool names", () => {
    expect(resolvePikuMcpToolPresentation("mcp__piku-code__piku_thread_read")).toEqual({
      displayName: "Read a Piku thread",
      logo: "piku-code",
    });
  });

  it("pretty prints Codex Piku MCP tool names", () => {
    expect(resolvePikuMcpToolPresentation("piku-code.create_threads")).toEqual({
      displayName: "Create Piku threads",
      logo: "piku-code",
    });
  });

  it("pretty prints bare Piku MCP toolkit names", () => {
    expect(resolvePikuMcpToolPresentation("list_scheduled_tasks")).toEqual({
      displayName: "List scheduled tasks",
      logo: "piku-code",
    });
  });

  it("pretty prints worktree Piku MCP tool names", () => {
    expect(resolvePikuMcpToolPresentation("mcp__piku-code__piku_worktree_handoff")).toEqual({
      displayName: "Hand off thread to a git worktree",
      logo: "piku-code",
    });
    expect(resolvePikuMcpToolPresentation("piku-code.piku_worktree_status")).toEqual({
      displayName: "Get thread worktree status",
      logo: "piku-code",
    });
  });

  it("pretty prints preview Piku MCP tool names", () => {
    expect(resolvePikuMcpToolPresentation("Piku-code.preview_open")).toEqual({
      displayName: "Open a page in the preview browser",
      logo: "piku-code",
    });
    expect(resolvePikuMcpToolPresentation("mcp__piku-code__preview_status")).toEqual({
      displayName: "Get preview browser status",
      logo: "piku-code",
    });
  });

  it("keeps unknown MCP tools on the generic renderer path", () => {
    expect(resolvePikuMcpToolPresentation("mcp__github__search_issues")).toBeNull();
  });
});
