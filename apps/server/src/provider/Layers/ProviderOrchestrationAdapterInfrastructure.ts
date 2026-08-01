import * as Layer from "effect/Layer";

import {
  ClaudeAgentSdkQueryRunner,
  claudeAgentSdkQueryRunnerLiveLayer,
} from "../../orchestration-v2/Adapters/ClaudeAdapterV2.ts";
import {
  CodexAppServerClientFactory,
  codexAppServerClientFactoryFromSettingsLayer,
} from "../../orchestration-v2/Adapters/CodexAdapterV2.ts";
import { IdAllocatorV2, layer as idAllocatorLayer } from "../../orchestration-v2/IdAllocator.ts";
import { layer as providerContinuationRequestsLayer } from "../../orchestration-v2/ProviderContinuationRequests.ts";
import { layer as providerModelChangeRequestsLayer } from "../../orchestration-v2/ProviderModelChangeRequests.ts";

export type ProviderOrchestrationAdapterInfrastructure =
  | ClaudeAgentSdkQueryRunner
  | CodexAppServerClientFactory
  | IdAllocatorV2;

/**
 * Infrastructure shared by the V2 adapters materialized inside provider
 * instances. `providerContinuationRequestsLayer` and
 * `providerModelChangeRequestsLayer` must be the same layer references the
 * orchestration runtime provides to its workers so Effect layer memoization
 * yields one shared queue each.
 */
export const ProviderOrchestrationAdapterInfrastructureLive = Layer.mergeAll(
  claudeAgentSdkQueryRunnerLiveLayer,
  codexAppServerClientFactoryFromSettingsLayer,
  idAllocatorLayer,
  providerContinuationRequestsLayer,
  providerModelChangeRequestsLayer,
);
