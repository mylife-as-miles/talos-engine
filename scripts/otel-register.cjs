"use strict";

// This file is loaded through NODE_OPTIONS before Talos imports Fastify,
// BullMQ, Pino, Redis, PostgreSQL, OpenAI, or any application module.
// Loading instrumentation after those modules would leave gaps in traces.
require("@opentelemetry/auto-instrumentations-node/register");

const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const {
  BullMQInstrumentation,
} = require("@appsignal/opentelemetry-instrumentation-bullmq");

registerInstrumentations({
  instrumentations: [
    new BullMQInstrumentation({
      // Talos runs are user-visible workflows. Keeping the process span as a
      // child of the publish span makes the API -> queue -> worker path one
      // navigable distributed trace instead of two traces joined only by a link.
      useProducerSpanAsConsumerParent: true,
    }),
  ],
});
