import type { StorageAdapter } from "./storage.js";
import {
  runOrchestratedJob as runOrchestratedJobBase,
  type RunJob,
  type RunResult,
} from "./runOrchestrator.js";
import {
  recordAgentStep,
  recordLlmCall,
  recordRunResult,
  withTalosRunSpan,
  type TalosRunTelemetry,
} from "./telemetry.js";

/**
 * Observed entry point for Talos runs.
 *
 * The underlying orchestrator remains independent of any backend. This wrapper
 * emits OpenTelemetry spans and metrics through the global provider configured
 * by the host process. It deliberately records metadata only: prompts, model
 * responses, screenshots, credentials, and page contents stay in Talos.
 */
export async function runOrchestratedJob(
  storage: StorageAdapter,
  job: RunJob,
): Promise<RunResult> {
  const telemetry: TalosRunTelemetry = {
    runId: job.runId,
    projectId: job.projectId,
    environmentName: process.env.TALOS_ENVIRONMENT_NAME ?? process.env.DEPLOYMENT_ENVIRONMENT,
    triggerRef: job.triggerRef,
    testId: job.testId,
    targetUrl: job.baseUrl,
  };

  return withTalosRunSpan(telemetry, async (span) => {
    span.addEvent("talos.run.started");

    const result = await runOrchestratedJobBase(storage, {
      ...job,
      onStep(step) {
        recordAgentStep(step);
        job.onStep?.(step);
      },
      onLLMCall(call) {
        recordLlmCall(call);
        job.onLLMCall?.(call);
      },
      onAgentPlan(items) {
        span.addEvent("talos.agent.plan.updated", {
          "talos.plan.items": items.length,
          "talos.plan.completed": items.filter((item) => item.status === "done").length,
          "talos.plan.failed": items.filter((item) => item.status === "failed").length,
        });
        job.onAgentPlan?.(items);
      },
      onActivity(activity) {
        span.addEvent("talos.agent.activity", {
          "talos.activity.kind": activity.kind,
        }, activity.at);
        job.onActivity?.(activity);
      },
    });

    recordRunResult(telemetry, result, span);
    span.addEvent("talos.run.completed", {
      "talos.run.status": result.status,
      "talos.run.steps": result.stepsDetail.length,
      "talos.run.bugs": result.bugsFound.length,
      "talos.run.llm_calls": result.llmCalls.length,
    });
    return result;
  });
}
