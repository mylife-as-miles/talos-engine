import {
  SpanKind,
  SpanStatusCode,
  context,
  metrics,
  trace,
  type Attributes,
  type Span,
} from "@opentelemetry/api";
import type { LLMCallRecord, RunStep } from "./agent.js";
import type { NetworkBug } from "./types.js";

const INSTRUMENTATION_NAME = "@talos/engine";
const INSTRUMENTATION_VERSION = "0.1.0";

const tracer = trace.getTracer(INSTRUMENTATION_NAME, INSTRUMENTATION_VERSION);
const meter = metrics.getMeter(INSTRUMENTATION_NAME, INSTRUMENTATION_VERSION);

const activeRuns = meter.createUpDownCounter("talos.agent.runs.active", {
  description: "Number of Talos agent runs currently executing.",
  unit: "{run}",
});
const runs = meter.createCounter("talos.agent.runs", {
  description: "Number of completed Talos agent runs.",
  unit: "{run}",
});
const runDuration = meter.createHistogram("talos.agent.run.duration", {
  description: "Wall-clock duration of Talos agent runs.",
  unit: "ms",
});
const agentSteps = meter.createCounter("talos.agent.steps", {
  description: "Number of browser-agent steps executed.",
  unit: "{step}",
});
const llmCalls = meter.createCounter("talos.gen_ai.calls", {
  description: "Number of LLM calls made by Talos agents.",
  unit: "{call}",
});
const llmDuration = meter.createHistogram("talos.gen_ai.call.duration", {
  description: "Latency of LLM calls made by Talos agents.",
  unit: "ms",
});
const llmTokens = meter.createCounter("talos.gen_ai.tokens", {
  description: "Input and output tokens consumed by Talos agents.",
  unit: "{token}",
});
const llmCost = meter.createCounter("talos.gen_ai.cost", {
  description: "Estimated LLM cost accumulated by Talos agents.",
  unit: "USD",
});
const browserNetworkErrors = meter.createCounter("talos.browser.network.errors", {
  description: "Action-correlated browser network errors found by Talos.",
  unit: "{error}",
});
const bugsDetected = meter.createCounter("talos.qa.bugs", {
  description: "Bugs detected during Talos runs.",
  unit: "{bug}",
});

export type TalosRunTelemetry = {
  runId?: string;
  projectId?: string;
  environmentName?: string;
  triggerRef?: string;
  testId?: string;
  targetUrl?: string;
};

function stringValue(value: unknown, fallback = "unknown"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function modelProvider(model: string): string {
  const normalized = model.toLowerCase();
  if (normalized.includes("openai") || normalized.startsWith("gpt-")) return "openai";
  if (normalized.includes("anthropic") || normalized.startsWith("claude-")) return "anthropic";
  if (normalized.includes("gemini") || normalized.includes("google")) return "google";
  if (normalized.includes("openrouter")) return "openrouter";
  return model.includes("/") ? model.split("/", 1)[0] : "unknown";
}

function safeTargetOrigin(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    return new URL(rawUrl).origin;
  } catch {
    return undefined;
  }
}

function runMetricAttributes(info: TalosRunTelemetry, status?: string): Attributes {
  return {
    "deployment.environment.name": stringValue(info.environmentName),
    "talos.trigger.type": stringValue(info.triggerRef),
    ...(status ? { "talos.run.status": status } : {}),
  };
}

function runSpanAttributes(info: TalosRunTelemetry): Attributes {
  const targetOrigin = safeTargetOrigin(info.targetUrl);
  return {
    ...(info.runId ? { "talos.run.id": info.runId } : {}),
    ...(info.projectId ? { "talos.project.id": info.projectId } : {}),
    ...(info.testId ? { "talos.test.id": info.testId } : {}),
    "deployment.environment.name": stringValue(info.environmentName),
    "talos.trigger.type": stringValue(info.triggerRef),
    ...(targetOrigin ? { "server.address": targetOrigin } : {}),
  };
}

export async function withTalosRunSpan<T>(
  info: TalosRunTelemetry,
  execute: (span: Span) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const metricAttributes = runMetricAttributes(info);
  activeRuns.add(1, metricAttributes);

  return tracer.startActiveSpan(
    "talos.agent.run",
    { kind: SpanKind.INTERNAL, attributes: runSpanAttributes(info) },
    async (span) => {
      try {
        const result = await execute(span);
        return result;
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        activeRuns.add(-1, metricAttributes);
        span.end();
        runDuration.record(Date.now() - startedAt, metricAttributes);
      }
    },
  );
}

export function recordRunResult(
  info: TalosRunTelemetry,
  result: {
    status: string;
    stepsDetail?: RunStep[];
    bugsFound?: Array<Pick<RunStep, "severity" | "bugType" | "source">>;
    llmCalls?: LLMCallRecord[];
  },
  span: Span = trace.getActiveSpan() ?? trace.wrapSpanContext({ traceId: "00000000000000000000000000000000", spanId: "0000000000000000", traceFlags: 0 }),
): void {
  const status = stringValue(result.status);
  const attributes = runMetricAttributes(info, status);
  runs.add(1, attributes);

  span.setAttributes({
    "talos.run.status": status,
    "talos.run.steps": result.stepsDetail?.length ?? 0,
    "talos.run.bugs": result.bugsFound?.length ?? 0,
    "talos.run.llm_calls": result.llmCalls?.length ?? 0,
  });

  if (status === "failed") {
    span.setStatus({ code: SpanStatusCode.ERROR, message: "Talos run failed" });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  for (const bug of result.bugsFound ?? []) {
    bugsDetected.add(1, {
      "talos.bug.severity": stringValue(bug.severity),
      "talos.bug.type": stringValue(bug.bugType),
      "talos.bug.source": stringValue(bug.source),
      "deployment.environment.name": stringValue(info.environmentName),
    });
  }
}

export function recordAgentStep(step: RunStep): void {
  const attributes: Attributes = {
    "talos.agent.action": stringValue(step.action),
    "talos.step.status": stringValue(step.status),
    "talos.execution.method": stringValue(step.executionMethod),
    "talos.step.source": stringValue(step.source, "navigator"),
    ...(step.bugType ? { "talos.bug.type": step.bugType } : {}),
    ...(step.severity ? { "talos.bug.severity": step.severity } : {}),
  };

  agentSteps.add(1, attributes);
  trace.getActiveSpan()?.addEvent("talos.agent.step", {
    ...attributes,
    "talos.step.index": step.index,
  }, step.at);
}

export function recordLlmCall(call: LLMCallRecord): void {
  const provider = modelProvider(call.model);
  const status = call.error ? "error" : "ok";
  const attributes: Attributes = {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": provider,
    "gen_ai.request.model": call.model,
    "talos.agent.type": stringValue(call.agent),
    "talos.llm.status": status,
    "talos.llm.has_vision": call.hasVision,
    "talos.llm.attempt": call.attempt,
    "talos.step.index": call.stepIndex,
  };

  llmCalls.add(1, attributes);
  llmDuration.record(Math.max(0, call.durationMs), attributes);
  if (call.inputTokens > 0) {
    llmTokens.add(call.inputTokens, { ...attributes, "gen_ai.token.type": "input" });
  }
  if (call.outputTokens > 0) {
    llmTokens.add(call.outputTokens, { ...attributes, "gen_ai.token.type": "output" });
  }
  if (call.costUsd > 0) {
    llmCost.add(call.costUsd, attributes);
  }

  const now = Date.now();
  const parentContext = context.active();
  const span = tracer.startSpan(
    "gen_ai.chat",
    {
      kind: SpanKind.CLIENT,
      startTime: now - Math.max(0, call.durationMs),
      attributes: {
        ...attributes,
        "gen_ai.usage.input_tokens": call.inputTokens,
        "gen_ai.usage.output_tokens": call.outputTokens,
        "talos.llm.cost_usd": call.costUsd,
      },
    },
    parentContext,
  );

  if (call.error) {
    span.recordException(call.error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: call.error.slice(0, 256) });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end(now);
}

export function recordNetworkBug(bug: NetworkBug): void {
  const attributes: Attributes = {
    "talos.network.error.type": stringValue(bug.type),
    "talos.bug.severity": stringValue(bug.severity),
    ...(typeof bug.statusCode === "number" ? { "http.response.status_code": bug.statusCode } : {}),
  };
  browserNetworkErrors.add(1, attributes);
  trace.getActiveSpan()?.addEvent("talos.browser.network_error", attributes);
}
