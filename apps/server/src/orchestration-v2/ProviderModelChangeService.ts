import { CommandId } from "@piku/contracts";
import { modelSelectionsEqual } from "@piku/shared/model";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type ProviderModelChangeRequest,
  ProviderModelChangeRequests,
} from "./ProviderModelChangeRequests.ts";
import { ThreadManagementService } from "./ThreadManagementService.ts";

/**
 * Drains ProviderModelChangeRequests and records each provider-initiated
 * model change (for example a Claude safety-classifier refusal fallback) as a
 * `thread.model-selection.set` dispatch. The thread projection — and every
 * client model picker reading it — then reflects the model actually serving
 * the session instead of the stale user selection. The command id is derived
 * from the provider event id, so command receipts absorb replays.
 */
export const workerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const requests = yield* ProviderModelChangeRequests;
    const threads = yield* ThreadManagementService;

    const applyModelChange = Effect.fn("ProviderModelChangeService.applyModelChange")(function* (
      request: ProviderModelChangeRequest,
    ) {
      const projection = yield* threads.getThreadProjection(request.threadId);
      if (projection.thread.deletedAt !== null || projection.thread.archivedAt !== null) {
        yield* Effect.logInfo("orchestration-v2.provider-model-change.thread-inactive", {
          threadId: request.threadId,
          providerThreadId: request.providerThreadId,
          reason: request.reason,
        });
        return;
      }
      if (modelSelectionsEqual(projection.thread.modelSelection, request.modelSelection)) {
        return;
      }
      yield* threads.dispatch({
        type: "thread.model-selection.set",
        commandId: CommandId.make(`provider-model-change:${request.requestId}`),
        threadId: request.threadId,
        modelSelection: request.modelSelection,
      });
      yield* Effect.logInfo("orchestration-v2.provider-model-change.applied", {
        threadId: request.threadId,
        providerThreadId: request.providerThreadId,
        driver: request.driver,
        reason: request.reason,
        fromModel: request.fromModel,
        toModel: request.toModel,
      });
    });

    yield* requests.take.pipe(
      Effect.flatMap((request) =>
        applyModelChange(request).pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("orchestration-v2.provider-model-change.apply-failed", {
              threadId: request.threadId,
              providerThreadId: request.providerThreadId,
              cause,
            }),
          ),
        ),
      ),
      Effect.forever,
      Effect.forkScoped,
    );
  }),
);
