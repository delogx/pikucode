import { expect, it } from "@effect/vitest";

import {
  renderLoopbackAuthorizationCompleteHtml,
  resolveLoopbackAuthorizationStage,
} from "./cliAuthHtml.ts";

it("renders the branded loopback authorization completion page", () => {
  const html = renderLoopbackAuthorizationCompleteHtml();

  expect(resolveLoopbackAuthorizationStage()).toBe("dev");
  expect(html).toContain("Piku Code (Dev)");
  expect(html).toContain('class="stage stage-dev"');
  expect(html).not.toContain("Secure terminal handoff");
  expect(html).toContain("You're connected");
  expect(html).toContain("Return to your terminal");
  expect(html).not.toContain('class="next"');
  expect(html).toContain('name="viewport"');
  expect(html).not.toContain('class="status"');
});

it("renders the matching header treatment for the nightly channel", () => {
  const nightly = renderLoopbackAuthorizationCompleteHtml("nightly");

  expect(nightly).toContain('<p class="brand">Piku Code (Nightly)</p>');
  expect(nightly).toContain('class="stage stage-nightly"');
  expect(nightly).toContain('data-stage="nightly"');
  // Every rendered stage class must have styling backing it.
  expect(nightly).toContain(".stage-nightly {");
  expect(nightly).not.toContain("stage-latest");
});
