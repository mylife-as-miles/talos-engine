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
  instrumentations: [new BullMQInstrumentation()],
});
