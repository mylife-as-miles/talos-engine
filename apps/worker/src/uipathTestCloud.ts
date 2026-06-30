import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import type { RunResult } from "@talos/engine";

const execFileAsync = promisify(execFile);

export type UiPathTestCloudPublishInput = {
  runId: string;
  projectId: string;
  environmentId: string;
  environmentName: string;
  baseUrl: string;
  intent: string;
  triggerRef: string;
  startedAt?: string | null;
  completedAt: string;
  summary: string | null;
  result: RunResult;
};

export type UiPathTestCloudPublishResult = {
  enabled: boolean;
  ok: boolean;
  message: string;
  artifactsDir?: string;
  command?: string;
};

type UiPathMode = "modern" | "legacy" | "custom";

type UiPathConfig = {
  enabled: boolean;
  mode: UiPathMode;
  cliPath: string;
  outputDir: string;
  orchestratorUrl: string;
  tenant: string;
  projectKey: string;
  testSetKey: string;
  executionType: string;
  waitForCompletion: boolean;
  timeoutSeconds: number;
  extraArgs: string[];
  customArgs: string[];
};

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "data", "uipath-test-cloud");

export async function publishToUiPathTestCloud(
  input: UiPathTestCloudPublishInput,
): Promise<UiPathTestCloudPublishResult> {
  const config = readConfig();
  if (!config.enabled) {
    return { enabled: false, ok: true, message: "UiPath Test Cloud integration disabled" };
  }

  const artifactsDir = path.join(config.outputDir, input.runId);
  fs.mkdirSync(artifactsDir, { recursive: true });

  const payloadPath = path.join(artifactsDir, "talos-run.json");
  const inputPath = path.join(artifactsDir, "uipath-input.json");
  const junitPath = path.join(artifactsDir, "talos-junit.xml");
  const resultPath = path.join(artifactsDir, "uipath-result.json");

  const payload = buildPayload(input);
  fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(inputPath, JSON.stringify(buildUiPathInput(payload), null, 2));
  fs.writeFileSync(junitPath, buildJunitXml(input));

  const validationError = validateConfig(config);
  if (validationError) {
    return {
      enabled: true,
      ok: false,
      message: validationError,
      artifactsDir,
    };
  }

  const args = buildCliArgs(config, {
    inputPath,
    payloadPath,
    junitPath,
    resultPath,
    input,
  });

  try {
    const { stdout, stderr } = await execFileAsync(config.cliPath, args, {
      cwd: process.cwd(),
      timeout: config.timeoutSeconds * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    if (output) fs.writeFileSync(path.join(artifactsDir, "uipath-cli.log"), output);
    return {
      enabled: true,
      ok: true,
      message: "UiPath Test Cloud execution submitted",
      artifactsDir,
      command: redactCommand(config.cliPath, args),
    };
  } catch (err) {
    const error = err as Error & { stdout?: string; stderr?: string };
    const output = [error.message, error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    if (output) fs.writeFileSync(path.join(artifactsDir, "uipath-cli-error.log"), output);
    return {
      enabled: true,
      ok: false,
      message: `UiPath Test Cloud execution failed: ${error.message}`,
      artifactsDir,
      command: redactCommand(config.cliPath, args),
    };
  }
}

function readConfig(): UiPathConfig {
  return {
    enabled: process.env.UIPATH_TEST_CLOUD_ENABLED === "true",
    mode: parseMode(process.env.UIPATH_TEST_CLOUD_MODE),
    cliPath: process.env.UIPATH_CLI_PATH || "uip",
    outputDir: process.env.UIPATH_TEST_CLOUD_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    orchestratorUrl: process.env.UIPATH_ORCHESTRATOR_URL || "",
    tenant: process.env.UIPATH_ORCHESTRATOR_TENANT || "",
    projectKey: process.env.UIPATH_TEST_CLOUD_PROJECT_KEY || "",
    testSetKey: process.env.UIPATH_TEST_CLOUD_TEST_SET_KEY || "",
    executionType: process.env.UIPATH_TEST_CLOUD_EXECUTION_TYPE || "manual",
    waitForCompletion: process.env.UIPATH_TEST_CLOUD_WAIT === "true",
    timeoutSeconds: Number(process.env.UIPATH_TEST_CLOUD_TIMEOUT_SECONDS || 600),
    extraArgs: splitArgs(process.env.UIPATH_TEST_CLOUD_EXTRA_ARGS || ""),
    customArgs: splitArgs(process.env.UIPATH_TEST_CLOUD_ARGS || ""),
  };
}

function parseMode(value: string | undefined): UiPathMode {
  if (value === "legacy" || value === "custom") return value;
  return "modern";
}

function validateConfig(config: UiPathConfig): string | null {
  if (config.mode === "custom") {
    return config.customArgs.length > 0 ? null : "UIPATH_TEST_CLOUD_ARGS is required in custom mode";
  }
  if (!config.testSetKey) return "UIPATH_TEST_CLOUD_TEST_SET_KEY is required";
  if (config.mode === "legacy" && (!config.orchestratorUrl || !config.tenant)) {
    return "UIPATH_ORCHESTRATOR_URL and UIPATH_ORCHESTRATOR_TENANT are required in legacy mode";
  }
  return null;
}

function buildCliArgs(
  config: UiPathConfig,
  context: {
    inputPath: string;
    payloadPath: string;
    junitPath: string;
    resultPath: string;
    input: UiPathTestCloudPublishInput;
  },
): string[] {
  if (config.mode === "custom") {
    return config.customArgs.map((arg) => replacePlaceholders(arg, config, context));
  }

  if (config.mode === "legacy") {
    return [
      "test",
      "run",
      config.orchestratorUrl,
      config.tenant,
      "--projectKey",
      config.projectKey,
      "--testsetkey",
      config.testSetKey,
      "--execution-type",
      config.executionType,
      "--input_path",
      context.inputPath,
      "--result_path",
      context.resultPath,
      "--timeout",
      String(config.timeoutSeconds),
      ...config.extraArgs,
    ];
  }

  return [
    "tm",
    "testsets",
    "run",
    "--test-set-key",
    config.testSetKey,
    "--execution-type",
    config.executionType,
    "--input-path",
    context.inputPath,
    "--output",
    "json",
    ...(config.waitForCompletion ? ["--wait", "--timeout", String(config.timeoutSeconds)] : []),
    ...config.extraArgs,
  ];
}

function replacePlaceholders(
  value: string,
  config: UiPathConfig,
  context: {
    inputPath: string;
    payloadPath: string;
    junitPath: string;
    resultPath: string;
    input: UiPathTestCloudPublishInput;
  },
): string {
  return value
    .replaceAll("{payloadPath}", context.payloadPath)
    .replaceAll("{inputPath}", context.inputPath)
    .replaceAll("{junitPath}", context.junitPath)
    .replaceAll("{resultPath}", context.resultPath)
    .replaceAll("{runId}", context.input.runId)
    .replaceAll("{status}", context.input.result.status)
    .replaceAll("{projectKey}", config.projectKey)
    .replaceAll("{testSetKey}", config.testSetKey)
    .replaceAll("{tenant}", config.tenant)
    .replaceAll("{orchestratorUrl}", config.orchestratorUrl);
}

function buildUiPathInput(payload: ReturnType<typeof buildPayload>) {
  return [
    {
      name: "TalosRunPayload",
      type: "String",
      value: JSON.stringify(JSON.stringify(payload)),
    },
    {
      name: "TalosRunId",
      type: "String",
      value: JSON.stringify(payload.runId),
    },
    {
      name: "TalosStatus",
      type: "String",
      value: JSON.stringify(payload.status),
    },
    {
      name: "TalosBugCount",
      type: "Int32",
      value: String(payload.metrics.bugCount),
    },
    {
      name: "TalosHighSeverityBugCount",
      type: "Int32",
      value: String(payload.metrics.highSeverityBugCount),
    },
  ];
}

function buildPayload(input: UiPathTestCloudPublishInput) {
  const bugCount = input.result.bugsFound.length;
  const highSeverityBugCount = input.result.bugsFound.filter((bug) => bug.severity === "high").length;
  return {
    source: "talos",
    runId: input.runId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    environmentName: input.environmentName,
    baseUrl: input.baseUrl,
    intent: input.intent,
    triggerRef: input.triggerRef,
    status: input.result.status,
    summary: input.summary,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    metrics: {
      stepCount: input.result.stepsDetail.length,
      bugCount,
      highSeverityBugCount,
      llmCallCount: input.result.llmCalls.length,
      memoryProposed: input.result.memoryProposed,
    },
    bugs: input.result.bugsFound.map((bug) => ({
      name: bug.target ?? bug.bugType ?? "Issue",
      description: bug.reasoning,
      severity: bug.severity,
      category: bug.bugType,
      url: bug.url,
      stepIndex: bug.index,
      source: bug.source,
      screenshotPath: bug.screenshotPath,
    })),
    steps: input.result.stepsDetail.map((step) => ({
      index: step.index,
      action: step.action,
      target: step.target,
      status: step.status,
      url: step.url,
      reasoning: step.reasoning,
      error: step.error,
      at: step.at,
    })),
    artifacts: {
      videoUrl: input.result.videoUrl,
    },
  };
}

function buildJunitXml(input: UiPathTestCloudPublishInput): string {
  const failures = input.result.status === "failed" ? 1 : 0;
  const failureText = input.summary || input.result.error || "Talos run failed";
  const bugProperties = input.result.bugsFound
    .map((bug, index) => `      <property name="bug.${index + 1}" value="${escapeXml(`${bug.severity ?? "unknown"}: ${bug.reasoning ?? ""}`)}" />`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="Talos Agentic Test" tests="1" failures="${failures}" errors="0" skipped="0">`,
    "  <properties>",
    `    <property name="talos.runId" value="${escapeXml(input.runId)}" />`,
    `    <property name="talos.projectId" value="${escapeXml(input.projectId)}" />`,
    `    <property name="talos.environment" value="${escapeXml(input.environmentName)}" />`,
    `    <property name="talos.baseUrl" value="${escapeXml(input.baseUrl)}" />`,
    `    <property name="talos.bugCount" value="${input.result.bugsFound.length}" />`,
    bugProperties,
    "  </properties>",
    `  <testcase classname="talos.agent" name="${escapeXml(input.intent)}">`,
    failures > 0 ? `    <failure message="${escapeXml(failureText)}">${escapeXml(failureText)}</failure>` : "",
    "  </testcase>",
    "</testsuite>",
    "",
  ].filter((line) => line !== "").join("\n");
}

function escapeXml(value: string | undefined | null): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function splitArgs(value: string): string[] {
  const args: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    args.push(match[1] ?? match[2] ?? match[0]);
  }
  return args;
}

function redactCommand(command: string, args: string[]): string {
  const redacted = args.map((arg, index) => {
    const prev = args[index - 1]?.toLowerCase();
    if (prev?.includes("password") || prev?.includes("secret") || prev?.includes("token") || prev?.includes("key")) {
      return "***";
    }
    if (/token|secret|password/i.test(arg) && arg.includes("=")) {
      return arg.replace(/=.*/, "=***");
    }
    return arg;
  });
  return [command, ...redacted].join(" ");
}
