import { spawn } from "node:child_process";
import path from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const preload = "--require ./scripts/otel-register.cjs";
const existingNodeOptions = process.env.NODE_OPTIONS?.trim() ?? "";
const nodeOptions = existingNodeOptions.includes("scripts/otel-register.cjs")
  ? existingNodeOptions
  : `${existingNodeOptions} ${preload}`.trim();

const commonOtel = {
  NODE_OPTIONS: nodeOptions,
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
  OTEL_EXPORTER_OTLP_PROTOCOL: process.env.OTEL_EXPORTER_OTLP_PROTOCOL ?? "http/protobuf",
  OTEL_TRACES_EXPORTER: process.env.OTEL_TRACES_EXPORTER ?? "otlp",
  OTEL_METRICS_EXPORTER: process.env.OTEL_METRICS_EXPORTER ?? "otlp",
  OTEL_LOGS_EXPORTER: process.env.OTEL_LOGS_EXPORTER ?? "otlp",
  OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: "false",
  OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE:
    process.env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE ?? "delta",
  OTEL_NODE_RESOURCE_DETECTORS:
    process.env.OTEL_NODE_RESOURCE_DETECTORS ?? "env,host,os,process,container",
  OTEL_RESOURCE_ATTRIBUTES:
    process.env.OTEL_RESOURCE_ATTRIBUTES ??
    `service.namespace=talos,service.version=${process.env.TALOS_VERSION ?? "dev"},deployment.environment.name=${process.env.TALOS_ENVIRONMENT_NAME ?? "development"}`,
};

const root = process.cwd();
const children = [
  spawn(npmCommand, ["run", "dev:api"], {
    stdio: "inherit",
    env: {
      ...process.env,
      ...commonOtel,
      OTEL_SERVICE_NAME: "talos-api",
      PORT: process.env.API_PORT ?? "11114",
    },
  }),
  spawn(npmCommand, ["run", "dev:worker"], {
    stdio: "inherit",
    env: {
      ...process.env,
      ...commonOtel,
      OTEL_SERVICE_NAME: "talos-worker",
      VIDEOS_DIR: process.env.VIDEOS_DIR ?? path.join(root, "data", "videos"),
      SCREENSHOTS_DIR: process.env.SCREENSHOTS_DIR ?? path.join(root, "data", "screenshots"),
    },
  }),
  spawn(npmCommand, ["run", "dev:web"], {
    stdio: "inherit",
    env: process.env,
  }),
];

let shuttingDown = false;
function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!shuttingDown && code && code !== 0) {
      process.exitCode = code;
      shutdown();
    }
  });
}
