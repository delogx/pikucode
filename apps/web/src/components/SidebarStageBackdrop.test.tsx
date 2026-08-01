import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  getStageArtwork,
  resolveEnvironmentIdentificationPillLabel,
  resolveSidebarStageBackdropVariant,
  resolveStageArtworkId,
  STAGE_ARTWORKS,
  StageArtworkFill,
} from "./SidebarStageBackdrop";

describe("SidebarStageBackdrop", () => {
  it("resolves stage artwork only when enabled", () => {
    expect(resolveSidebarStageBackdropVariant("Dev")).toBe("dev");
    expect(resolveSidebarStageBackdropVariant("Nightly")).toBe("nightly");
    expect(resolveSidebarStageBackdropVariant("Dev", false)).toBeNull();
    expect(resolveSidebarStageBackdropVariant("")).toBeNull();
  });

  it("resolves supported environment pill labels", () => {
    expect(resolveEnvironmentIdentificationPillLabel("Dev")).toBe("Dev");
    expect(resolveEnvironmentIdentificationPillLabel("nightly")).toBe("Nightly");
    expect(resolveEnvironmentIdentificationPillLabel("")).toBeNull();
  });

  it("keeps the per-channel artwork when the selection is auto", () => {
    expect(
      resolveStageArtworkId({
        stageLabel: "Dev",
        sidebarArtwork: "auto",
        environmentIdentificationMode: "artwork",
      }),
    ).toBe("blueprint");
    expect(
      resolveStageArtworkId({
        stageLabel: "Nightly",
        sidebarArtwork: "auto",
        environmentIdentificationMode: "artwork",
      }),
    ).toBe("night-sky");
    expect(
      resolveStageArtworkId({
        stageLabel: "",
        sidebarArtwork: "auto",
        environmentIdentificationMode: "artwork",
      }),
    ).toBeNull();
  });

  it("hides auto artwork when environment identification is not artwork", () => {
    for (const environmentIdentificationMode of ["pill", "none"] as const) {
      expect(
        resolveStageArtworkId({
          stageLabel: "Dev",
          sidebarArtwork: "auto",
          environmentIdentificationMode,
        }),
      ).toBeNull();
    }
  });

  it("shows an explicit artwork choice on every channel and mode", () => {
    for (const stageLabel of ["Dev", "Nightly", ""]) {
      for (const environmentIdentificationMode of ["artwork", "pill", "none"] as const) {
        expect(
          resolveStageArtworkId({
            stageLabel,
            sidebarArtwork: "nebula",
            environmentIdentificationMode,
          }),
        ).toBe("nebula");
      }
    }
  });

  it("registers every pickable artwork exactly once", () => {
    const ids = STAGE_ARTWORKS.map((artwork) => artwork.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(getStageArtwork(id).id).toBe(id);
    }
  });

  it("renders raster artworks as plain images", () => {
    const markup = renderToStaticMarkup(<StageArtworkFill artwork={getStageArtwork("aurora")} />);
    expect(markup).toContain("<img");
    expect(markup).toContain("object-cover");
  });

  it.each(["night-sky", "blueprint"] as const)(
    "uses unique SVG definition ids when the %s artwork is rendered more than once",
    (id) => {
      const artwork = getStageArtwork(id);
      const markup = renderToStaticMarkup(
        <>
          <StageArtworkFill artwork={artwork} />
          <StageArtworkFill artwork={artwork} compact />
        </>,
      );
      const ids = Array.from(markup.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);

      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );
});
