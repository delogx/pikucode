import { assert, it } from "@effect/vitest";

import { detectCliRunner, formatCliCommand, SUGGESTED_PACKAGE_SPEC } from "./invocation.ts";

it("detects package runners from their cache entry paths", () => {
  assert.equal(
    detectCliRunner("/home/theo/.npm/_npx/abc123/node_modules/piku/dist/bin.mjs"),
    "npx",
  );
  assert.equal(
    detectCliRunner(
      "C:\\Users\\theo\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\piku\\dist\\bin.mjs",
    ),
    "npx",
  );
  assert.equal(
    detectCliRunner("/home/theo/.cache/pnpm/dlx/abc/node_modules/piku/dist/bin.mjs"),
    "pnpm dlx",
  );
  assert.equal(
    detectCliRunner("/home/theo/.local/share/pnpm/.pnpm/dlx/abc/node_modules/piku/dist/bin.mjs"),
    "pnpm dlx",
  );
  assert.equal(
    detectCliRunner(
      "C:\\Users\\theo\\AppData\\Local\\pnpm-cache\\dlx\\abc\\node_modules\\piku\\dist\\bin.mjs",
    ),
    "pnpm dlx",
  );
  assert.equal(detectCliRunner("/home/theo/.bun/install/cache/piku@0.0.31/dist/bin.mjs"), "bunx");
  assert.equal(
    detectCliRunner("/tmp/bunx-1000-piku@latest/node_modules/piku/dist/bin.mjs"),
    "bunx",
  );
  assert.equal(
    detectCliRunner(
      "C:\\Users\\theo\\AppData\\Local\\Temp\\bunx-0-piku@latest\\node_modules\\piku\\dist\\bin.mjs",
    ),
    "bunx",
  );
});

it("treats global installs and checkouts as direct invocations", () => {
  assert.isNull(detectCliRunner("/usr/local/lib/node_modules/piku/dist/bin.mjs"));
  assert.isNull(detectCliRunner("/home/theo/Code/work/pikucode/apps/server/dist/bin.mjs"));
  assert.isNull(
    detectCliRunner("/home/theo/.pikucode/runtime/0.0.31/node_modules/piku/dist/bin.mjs"),
  );
  assert.isNull(detectCliRunner(""));
});

it("re-suggests the nightly channel, the only published dist-tag", () => {
  assert.equal(SUGGESTED_PACKAGE_SPEC, "piku@nightly");
});

it("formats serve suggestions to match the launching command", () => {
  // Package runners re-resolve the spec on every run, so they must carry the tag.
  assert.equal(
    formatCliCommand({
      subcommand: "serve",
      entryPath: "/home/theo/.npm/_npx/abc/node_modules/piku/dist/bin.mjs",
    }),
    "npx piku@nightly serve",
  );
  assert.equal(
    formatCliCommand({
      subcommand: "serve",
      entryPath: "/tmp/bunx-1000-piku@latest/node_modules/piku/dist/bin.mjs",
    }),
    "bunx piku@nightly serve",
  );
  // A global install already has the binary on PATH: no spec, no tag.
  assert.equal(
    formatCliCommand({
      subcommand: "serve",
      entryPath: "/usr/local/lib/node_modules/piku/dist/bin.mjs",
    }),
    "piku serve",
  );
});
