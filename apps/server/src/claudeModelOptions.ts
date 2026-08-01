import type { ModelSelection } from "@piku/contracts";
import {
  getModelSelectionBooleanOptionValue,
  getModelSelectionStringOptionValue,
  getProviderOptionDescriptors,
  resolvePromptInjectedEffort,
} from "@piku/shared/model";

import {
  getClaudeModelCapabilities,
  isClaudeUltracodeEffort,
  normalizeClaudeCliEffort,
  resolveClaudeApiModelId,
  resolveClaudeEffort,
} from "./provider/Layers/ClaudeProvider.ts";

export interface CompiledClaudeModelSelection {
  readonly apiModelId: string;
  readonly effort: string | undefined;
  readonly promptEffort: string | undefined;
  readonly settings: Readonly<Record<string, boolean>>;
  readonly queryIdentity: string;
}

const ONE_MILLION_CONTEXT_SUFFIX = "[1m]";

/**
 * Map a provider-reported API model id back onto a Piku model selection.
 *
 * Claude Code reports the model it actually runs on (for example the
 * `fallback_model` of a safety-classifier refusal fallback) as an API model
 * id, optionally carrying the `[1m]` context-window suffix. The result keeps
 * the current selection's provider instance, carries over option selections
 * the target model still supports, and translates the `[1m]` suffix into the
 * `contextWindow` option when the target model exposes one.
 */
export function claudeModelSelectionForApiModelId(
  current: ModelSelection,
  apiModelId: string,
): ModelSelection {
  const trimmed = apiModelId.trim();
  const oneMillionContext = trimmed.endsWith(ONE_MILLION_CONTEXT_SUFFIX);
  const model = oneMillionContext ? trimmed.slice(0, -ONE_MILLION_CONTEXT_SUFFIX.length) : trimmed;
  const descriptors = getProviderOptionDescriptors({ caps: getClaudeModelCapabilities(model) });
  const supportedOptionIds = new Set(descriptors.map((descriptor) => descriptor.id));
  const carried = (current.options ?? []).filter(
    (option) =>
      supportedOptionIds.has(option.id) && !(oneMillionContext && option.id === "contextWindow"),
  );
  const options = [
    ...carried,
    ...(oneMillionContext && supportedOptionIds.has("contextWindow")
      ? [{ id: "contextWindow", value: "1m" }]
      : []),
  ];
  return {
    instanceId: current.instanceId,
    model,
    ...(options.length === 0 ? {} : { options }),
  };
}

/** Compile every Claude model option at the provider boundary. */
export function compileClaudeModelSelection(
  selection: ModelSelection,
): CompiledClaudeModelSelection {
  const capabilities = getClaudeModelCapabilities(selection.model);
  const descriptors = getProviderOptionDescriptors({ caps: capabilities });
  const supportsBoolean = (id: string) =>
    descriptors.some((descriptor) => descriptor.type === "boolean" && descriptor.id === id);
  const rawEffort = getModelSelectionStringOptionValue(selection, "effort");
  const resolvedEffort = resolveClaudeEffort(capabilities, rawEffort);
  const effort = normalizeClaudeCliEffort(resolvedEffort, selection.model);
  const fastMode = supportsBoolean("fastMode")
    ? getModelSelectionBooleanOptionValue(selection, "fastMode")
    : undefined;
  const thinking = supportsBoolean("thinking")
    ? getModelSelectionBooleanOptionValue(selection, "thinking")
    : undefined;
  const settings = {
    ...(typeof thinking === "boolean" ? { alwaysThinkingEnabled: thinking } : {}),
    ...(typeof fastMode === "boolean" ? { fastMode } : {}),
    ...(isClaudeUltracodeEffort(resolvedEffort) ? { ultracode: true } : {}),
  };
  const apiModelId = resolveClaudeApiModelId(selection);
  const promptEffort = resolvePromptInjectedEffort(capabilities, rawEffort) ?? undefined;
  return {
    apiModelId,
    effort,
    promptEffort,
    settings,
    queryIdentity: JSON.stringify({ apiModelId, effort: effort ?? null, settings }),
  };
}
