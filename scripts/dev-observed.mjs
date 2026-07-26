import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const preload = "--require @opentelemetry/auto-instrumentations-node/register";
const existingNodeOptions = process.env.NODE_OPTIONS?.trim() ?? "";
const nodeOptions = existingNodeOptions.includes("@opentelemetry/auto-instrumentations-node/register")
  ? existingNodeOptions
  : `${existingNodeOptions} ${preload}`.trim();

const child = spawn(npmCommand, ["run", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
    OTEL_EXPORTER_OTLP_PROTOCOL: process.env.OTEL_EXPORTER_OTLP_PROTOCOL ?? "http/protobuf",
    OTEL_TRACES_EXPORTER: process.env.OTEL_TRACES_EXPORTER ?? "otlp",
    OTEL_METRICS_EXPORTER: process.env.OTEL_METRICS_EXPORTER ?? "otlp",
    OTEL_LOGS_EXPORTER: process.env.OTEL_LOGS_EXPORTER ?? "otlp",
    OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE:
      process.env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE ?? "delta",
    OTEL_NODE_RESOURCE_DETECTORS:
      process.env.OTEL_NODE_RESOURCE_DETECTORS ?? "env,host,os,process,container",
    OTEL_RESOURCE_ATTRIBUTES:
      process.env.OTEL_RESOURCE_ATTRIBUTES ??
      `service.namespace=talos,service.version=${process.env.TALOS_VERSION ?? "dev"},deployment.environment.name=${process.env.TALOS_ENVIRONMENT_NAME ?? "development"}`,
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
