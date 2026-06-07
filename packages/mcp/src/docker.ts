import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TalosClient } from "@talosai/client";

const exec = promisify(execFile);

/**
 * Start Talos Docker containers.
 * Looks for docker-compose.yml in standard locations, or uses the bundled image.
 */
export async function startDocker(): Promise<void> {
  try {
    await exec("docker", ["compose", "up", "-d"], { timeout: 60_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to start Talos Docker containers. ` +
      `Make sure Docker is installed and running.\n${msg}`,
    );
  }
}

/** Stop Talos Docker containers. */
export async function stopDocker(): Promise<void> {
  try {
    await exec("docker", ["compose", "down"], { timeout: 30_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to stop Talos Docker containers.\n${msg}`);
  }
}

/**
 * Wait for the Talos API to become healthy.
 * Polls /health every 2 seconds up to `timeoutMs`.
 */
export async function waitForHealthy(
  client: TalosClient,
  timeoutMs = 30_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await client.checkHealth()) return true;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return false;
}
