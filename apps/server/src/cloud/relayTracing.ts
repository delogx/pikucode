import { makeRelayClientTracingLayer } from "@piku/shared/relayTracing";

import { resolveRelayClientTracingConfig } from "./publicConfig.ts";

const relayClientTracingConfig = resolveRelayClientTracingConfig();

export const headlessRelayClientTracingLayer = makeRelayClientTracingLayer(
  relayClientTracingConfig,
  {
    serviceName: "piku-headless-relay-client",
    runtime: "node",
    client: "headless-cli",
  },
);

export const serverRelayBrokerTracingLayer = makeRelayClientTracingLayer(relayClientTracingConfig, {
  serviceName: "piku-server",
  runtime: "node",
  client: "environment-server",
  component: "relay-broker",
});
