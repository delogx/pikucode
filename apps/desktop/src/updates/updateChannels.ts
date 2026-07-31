import type { DesktopUpdateChannel } from "@piku/contracts";

const NIGHTLY_VERSION_PATTERN = /-nightly\.\d{8}\.\d+$/;

/** Nightly is the only shipped channel. */
export const DESKTOP_UPDATE_CHANNEL: DesktopUpdateChannel = "nightly";

export function isNightlyDesktopVersion(version: string): boolean {
  return NIGHTLY_VERSION_PATTERN.test(version);
}
