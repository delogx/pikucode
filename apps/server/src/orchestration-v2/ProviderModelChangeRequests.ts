import { ModelSelection, ProviderDriverKind, ProviderThreadId, ThreadId } from "@piku/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";

export interface ProviderModelChangeRequest {
  readonly threadId: ThreadId;
  readonly providerThreadId: ProviderThreadId;
  readonly driver: ProviderDriverKind;
  /**
   * Stable identity of the provider event that caused the change (for Claude,
   * the SDK message uuid). The worker derives the command id from it, so a
   * replayed provider message cannot apply the same change twice.
   */
  readonly requestId: string;
  /** Provider-native model ids, as reported by the provider runtime. */
  readonly fromModel: string;
  readonly toModel: string;
  /** The thread's model selection translated to the model now in effect. */
  readonly modelSelection: ModelSelection;
  readonly reason: "refusal_fallback";
}

/**
 * Adapters offer a model-change request when the provider runtime switches
 * the session's model on its own — for example Claude Code re-running a
 * safety-flagged request on its fallback model and keeping the session there.
 * The orchestrator records the new selection on the thread so the projection
 * (and every model picker reading it) reflects the model actually serving the
 * session. The default reference drops requests, keeping adapter construction
 * dependency-free in tests; the live layer must be shared with the
 * ProviderModelChangeService worker that drains it.
 */
export class ProviderModelChangeRequests extends Context.Reference<{
  readonly offer: (request: ProviderModelChangeRequest) => Effect.Effect<void>;
  readonly take: Effect.Effect<ProviderModelChangeRequest>;
}>("piku/orchestration-v2/ProviderModelChangeRequests", {
  defaultValue: () => ({ offer: () => Effect.void, take: Effect.never }),
}) {}

export const layer = Layer.effect(
  ProviderModelChangeRequests,
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<ProviderModelChangeRequest>();
    return {
      offer: (request: ProviderModelChangeRequest) =>
        Queue.offer(queue, request).pipe(Effect.asVoid),
      take: Queue.take(queue),
    };
  }),
);
