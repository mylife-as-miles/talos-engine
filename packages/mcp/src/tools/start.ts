import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TalosClient } from "@talosai/client";
import { startDocker, stopDocker, waitForHealthy } from "../docker.js";

export function registerStartTools(server: McpServer, client: TalosClient, isCloud: boolean) {
  server.tool(
    "talos_start",
    `Start the Talos testing platform via Docker. Only needed in local/self-hosted mode — not applicable for Talos Cloud.

WHEN TO USE:
  • Before any other Talos tool if Talos is not yet running
  • User says "start talos", "launch talos"
  • Another tool returns "Talos is not running"
  • After a machine restart

WHAT THIS DOES:
  • Runs 'docker compose up -d' to start the Talos API + workers + database containers
  • Waits up to 30 seconds for the API to become healthy
  • Returns the API and web dashboard URLs once ready

PREREQUISITES: Docker must be installed and running on the machine.

After starting, call talos_status to see current projects, or talos_setup_project to create a new project.`,
    {},
    async () => {
      if (isCloud) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "Connected to Talos Cloud — talos_start is not needed.",
              nextSteps: ["Call talos_status to see your cloud projects, or talos_setup_project to create a new one."],
            }),
          }],
        };
      }

      const alreadyRunning = await client.checkHealth();
      if (alreadyRunning) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "already_running",
              apiUrl: client.apiUrl,
              webUrl: client.webUrl,
              nextSteps: [
                "Talos is already running.",
                "Call talos_status to see current projects, or talos_setup_project to configure a new project.",
              ],
            }),
          }],
        };
      }

      try {
        await startDocker();
      } catch (err) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              error: err instanceof Error ? err.message : String(err),
              fix: "Make sure Docker Desktop is installed and running, then retry talos_start.",
            }),
          }],
          isError: true,
        };
      }

      const healthy = await waitForHealthy(client);
      if (!healthy) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: "Talos started but the API is not responding after 30s.",
              fix: "Check Docker logs with: docker compose logs api",
            }),
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "running",
            apiUrl: client.apiUrl,
            webUrl: client.webUrl,
            nextSteps: [
              "Talos is running.",
              "Call talos_status to see existing projects.",
              "Or call talos_setup_project to create a new project for your app.",
            ],
          }),
        }],
      };
    },
  );

  server.tool(
    "talos_stop",
    `Stop the Talos testing platform (Docker containers). Only works in local/self-hosted mode.

WHEN TO USE:
  • User says "stop talos", "shut down talos"
  • Freeing up system resources when done testing

Runs 'docker compose down' to stop all Talos containers.`,
    {},
    async () => {
      if (isCloud) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: "Connected to Talos Cloud — talos_stop is not applicable." }),
          }],
        };
      }

      try {
        await stopDocker();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "stopped",
              nextSteps: ["Talos has been stopped. Call talos_start when you want to resume testing."],
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              error: err instanceof Error ? err.message : String(err),
            }),
          }],
          isError: true,
        };
      }
    },
  );
}
