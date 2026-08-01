import {
  type OrchestrationV2DomainEvent,
  type OrchestrationV2ProviderFailure,
  type OrchestrationV2ThreadGoal,
  type ThreadId,
} from "@piku/contracts";
import {
  activeThreadGoal,
  foldProviderTurnIntoThreadGoal,
  foldTurnUsageIntoThreadGoal,
} from "@piku/shared/threadGoal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { EventSinkV2 } from "./EventSink.ts";
import { IdAllocatorV2 } from "./IdAllocator.ts";
import { ThreadManagementService } from "./ThreadManagementService.ts";

const RATE_LIMIT_PATTERN = /rate.?limit|usage.?limit|quota|too many requests|overloaded/i;

export function isRateLimitProviderFailure(failure: OrchestrationV2ProviderFailure): boolean {
  return (
    (failure.code !== null && (failure.code === "429" || RATE_LIMIT_PATTERN.test(failure.code))) ||
    RATE_LIMIT_PATTERN.test(failure.message)
  );
}

/**
 * Folds provider activity into the thread's active goal and republishes it as
 * `goal.updated` events: token usage (both providers emit cumulative per-turn
 * `turn-usage.updated` readings), provider turn lifecycle (time accounting),
 * and rate-limit failures (usageLimited). Event-driven so Claude and Codex
 * threads get identical goal status behavior from one code path.
 */
export const workerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const threads = yield* ThreadManagementService;
    const eventSink = yield* EventSinkV2;
    const idAllocator = yield* IdAllocatorV2;

    const publishGoal = Effect.fnUntraced(function* (
      threadId: ThreadId,
      goal: OrchestrationV2ThreadGoal,
      occurredAt: DateTime.Utc,
    ) {
      yield* eventSink.write({
        events: [
          {
            id: yield* idAllocator.allocate.event({ threadId }),
            type: "goal.updated",
            threadId,
            occurredAt,
            payload: goal,
          },
        ],
      });
    });

    const trackEvent = Effect.fnUntraced(function* (event: OrchestrationV2DomainEvent) {
      if (
        event.type !== "turn-usage.updated" &&
        event.type !== "provider-turn.updated" &&
        !(event.type === "turn-item.updated" && event.payload.type === "error")
      ) {
        return;
      }
      const projection = yield* threads.getThreadProjection(event.threadId);
      const goal = activeThreadGoal(projection.goals);
      if (goal === null) {
        return;
      }
      const now = yield* DateTime.now;
      switch (event.type) {
        case "turn-usage.updated": {
          const next = foldTurnUsageIntoThreadGoal({ goal, usage: event.payload, now });
          if (next !== null) {
            yield* publishGoal(event.threadId, next, now);
          }
          return;
        }
        case "provider-turn.updated": {
          const next = foldProviderTurnIntoThreadGoal({ goal, turn: event.payload, now });
          if (next !== null) {
            yield* publishGoal(event.threadId, next, now);
          }
          return;
        }
        case "turn-item.updated": {
          if (
            event.payload.type !== "error" ||
            goal.status !== "active" ||
            !isRateLimitProviderFailure(event.payload.failure)
          ) {
            return;
          }
          yield* publishGoal(
            event.threadId,
            {
              ...goal,
              status: "usageLimited",
              statusReason: "Provider usage limit hit",
              updatedAt: now,
            },
            now,
          );
          return;
        }
      }
    });

    yield* threads.streamDomainEvents.pipe(
      Stream.runForEach((event) =>
        trackEvent(event).pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("Thread goal tracking failed", {
              threadId: event.threadId,
              eventType: event.type,
              cause,
            }),
          ),
        ),
      ),
      Effect.forkScoped,
    );
  }),
);
