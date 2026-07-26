"use strict";

require("@opentelemetry/auto-instrumentations-node/register");

const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const fastifyOtel = require("@fastify/otel");
const FastifyOtelInstrumentation = fastifyOtel.FastifyOtelInstrumentation || fastifyOtel.default || fastifyOtel;
const { BullMQInstrumentation } = require("@appsignal/opentelemetry-instrumentation-bullmq");

registerInstrumentations({
  instrumentations: [
    new FastifyOtelInstrumentation({
      registerOnInitialization: true,
      instrumentHooks: false,
      ignorePaths: "/health",
    }),
    new BullMQInstrumentation({
      useProducerSpanAsConsumerParent: true,
    }),
  ],
});
