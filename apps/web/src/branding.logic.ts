const NIGHTLY_SERVER_VERSION_PATTERN = /-nightly\.\d{8}\.\d+$/;

export function formatAppDisplayName(input: {
  readonly baseName: string;
  readonly stageLabel: string;
}): string {
  return `${input.baseName} (${input.stageLabel})`;
}

/**
 * Resolved sidebar v2 state: an explicit choice if the user has made one,
 * otherwise the default.
 *
 * Nightly is the only shipped channel, so every build (nightly or local dev)
 * defaults v2 on — the Settings → Beta toggle is the only way to land on v1.
 *
 * A stored `enabled: true` counts as an explicit choice even without the
 * companion flag. `true` was never the schema default, so it can only have come
 * from the Settings → Beta toggle. Mirrors how
 * `normalizeDesktopSettingsDocument` treats a legacy stored
 * `updateChannel: "nightly"` as user-configured.
 *
 * `settingsHydrated` guards the startup window: client settings load
 * asynchronously and the pre-hydration snapshot is just the schema defaults, so
 * resolving against it would mount one sidebar and swap it out a tick later,
 * remounting the tree. While hydrating, hold v1 — where both paths already
 * start.
 */
export function resolveSidebarV2Enabled(input: {
  readonly enabled: boolean;
  readonly configuredByUser: boolean;
  readonly settingsHydrated: boolean;
}): boolean {
  if (!input.settingsHydrated) {
    return false;
  }

  return input.configuredByUser ? input.enabled : true;
}

/**
 * Stage label for the connected environment: a nightly server wins over the
 * client's own label, so a local dev build pointed at a nightly server reports
 * Nightly. Otherwise the client's label stands.
 */
export function resolveServerBackedAppStageLabel(input: {
  readonly primaryServerVersion: string | null | undefined;
  readonly fallbackStageLabel: string;
}): string {
  return input.primaryServerVersion &&
    NIGHTLY_SERVER_VERSION_PATTERN.test(input.primaryServerVersion)
    ? "Nightly"
    : input.fallbackStageLabel;
}

export function resolveServerBackedAppDisplayName(input: {
  readonly baseName: string;
  readonly fallbackDisplayName: string;
  readonly fallbackStageLabel: string;
  readonly primaryServerVersion: string | null | undefined;
}): string {
  const stageLabel = resolveServerBackedAppStageLabel({
    primaryServerVersion: input.primaryServerVersion,
    fallbackStageLabel: input.fallbackStageLabel,
  });

  return stageLabel === input.fallbackStageLabel
    ? input.fallbackDisplayName
    : formatAppDisplayName({ baseName: input.baseName, stageLabel });
}
