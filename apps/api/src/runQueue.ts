import { Queue } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

/** BullMQ forbids ':' in queue names (reserved for Redis Cluster key tags). */
export const RUN_QUEUE_NAME = "talos-runs";

export interface RunJobData {
  runId: string;
  baseUrl: string;
  intent: string;
  projectId: string;
  environmentId: string;
  environmentName: string;
  auth: any;
  testId?: string;
  context?: string;
  saveScreenshots?: boolean;
  maxSteps?: number;
  recordVideo: boolean;
  triggerRef: string;
}

function parseRedisUrl(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
  };
}

function createQueueTelemetry() {
  return new BullMQOtel({
    tracerName: "@talos/api",
    meterName: "@talos/api",
    version: process.env.TALOS_VERSION || "dev",
    enableMetrics: true,
  });
}

export function createRunQueue(redisUrl: string) {
  const connection = parseRedisUrl(redisUrl);
  const queue = new Queue<RunJobData>(RUN_QUEUE_NAME, {
    connection,
    telemetry: createQueueTelemetry(),
  });
  return { queue, connection };
}
