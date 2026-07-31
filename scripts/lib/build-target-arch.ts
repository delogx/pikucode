import { HostProcessArchitecture } from "@piku/shared/hostProcess";
import * as Effect from "effect/Effect";

export type BuildArch = "arm64" | "x64" | "universal";
export type BuildPlatform = "mac" | "linux";

interface PlatformConfig {
  readonly archChoices: ReadonlyArray<BuildArch>;
}

const resolveHostProcessArch = Effect.fn("resolveHostProcessArch")(function* () {
  const processArch = yield* HostProcessArchitecture;
  if (processArch === "arm64") return "arm64";
  if (processArch === "x64") return "x64";
  return undefined;
});

export const getDefaultBuildArch = Effect.fn("getDefaultBuildArch")(function* (
  platform: BuildPlatform,
  platformConfig: PlatformConfig,
) {
  const hostArch = yield* resolveHostProcessArch();
  if (hostArch && platformConfig.archChoices.includes(hostArch)) {
    return hostArch;
  }

  return platformConfig.archChoices[0] ?? "x64";
});
