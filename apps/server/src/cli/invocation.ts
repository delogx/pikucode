import * as Effect from "effect/Effect";

import { HostProcessArguments } from "@piku/shared/hostProcess";

export type CliRunner = "npx" | "pnpm dlx" | "bunx";

/**
 * How the CLI was launched, judged by where its entry script lives. Each
 * package runner executes out of a distinctive cache/temp layout:
 *
 *   npx      ~/.npm/_npx/<hash>/node_modules/...
 *   pnpm dlx ~/.cache/pnpm/dlx/... or $PNPM_HOME/.pnpm/dlx/...
 *   bunx     ~/.bun/install/cache/... or $TMPDIR/bunx-<uid>-<spec>/...
 *
 * Global installs and repo checkouts match none of these and return null.
 * Detection is best-effort; callers must fail closed to a plain `piku` command.
 */
export function detectCliRunner(entryPath: string): CliRunner | null {
  const path = entryPath.replaceAll("\\", "/");
  if (path.includes("/_npx/")) {
    return "npx";
  }
  if (
    path.includes("/pnpm/dlx/") ||
    path.includes("/.pnpm/dlx/") ||
    path.includes("/pnpm-cache/dlx/")
  ) {
    return "pnpm dlx";
  }
  if (path.includes("/.bun/install/cache/") || path.includes("/bunx-")) {
    return "bunx";
  }
  return null;
}

/**
 * The `piku` package spec to suggest. The literal spec the user typed (e.g.
 * `piku@nightly`) is resolved away before our process starts, and `nightly` is
 * the only published dist-tag, so always re-suggest it: a bare `piku` would
 * resolve through `latest`, which no release publishes.
 */
export const SUGGESTED_PACKAGE_SPEC = "piku@nightly";

/**
 * Render a `piku <subcommand>` suggestion that matches how this process was
 * launched, so copy/pasting it actually works: `npx piku connect` suggests
 * `npx piku@nightly serve`, while a global install suggests a plain
 * `piku serve` against the already-installed binary.
 */
export function formatCliCommand(input: {
  readonly subcommand: string;
  readonly entryPath: string;
}): string {
  const runner = detectCliRunner(input.entryPath);
  if (runner === null) {
    return `piku ${input.subcommand}`;
  }
  return `${runner} ${SUGGESTED_PACKAGE_SPEC} ${input.subcommand}`;
}

/** `formatCliCommand` against this process's real entry path. */
export const resolveCliCommand = (subcommand: string) =>
  Effect.map(HostProcessArguments, (processArguments) =>
    formatCliCommand({
      subcommand,
      entryPath: processArguments[1] ?? "",
    }),
  );
