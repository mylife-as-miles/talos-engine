import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TalosClient } from "@talosai/client";

const TALOS_OVERVIEW = `Talos is an AI-powered browser testing platform. It uses LLM agents to:
  • Discover flows in your app automatically (talos_discover_flows)
  • Run AI browser agents that navigate, interact, and find bugs (talos_run_test)
  • Track bugs by severity and category (talos_get_bugs)
  • Save reusable tests (talos_list_tests)
  • Build regression test scripts from successful runs

TYPICAL WORKFLOW:
  1. talos_start           — start the platform (local Docker mode only)
  2. talos_setup_project   — create a project with your app URL + auth config
  3. talos_discover_flows  — explore the app and save discovered flows as tests (optional but recommended)
  4. talos_run_test        — run an AI test agent with a natural language intent or a saved test
  5. talos_get_bugs        — review bugs found

WHEN TO CALL talos_status:
  • The user asks "what is talos", "is talos set up", "show me my projects", or anything orientation-related
  • Before starting any workflow to understand current state
  • When you are not sure what project ID to use`;

export function registerStatusTool(server: McpServer, client: TalosClient, isCloud: boolean) {
  server.tool(
    "talos_status",
    `${TALOS_OVERVIEW}

Returns full system status: whether Talos is running, all projects with their environments and auth configuration, coverage stats, open bug counts, and a recommended next-action plan. Call this first when you don't know the current state.`,
    {},
    async () => {
      const isRunning = await client.checkHealth();

      if (!isRunning) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              talos: TALOS_OVERVIEW,
              connection: {
                isRunning: false,
                apiUrl: client.apiUrl,
                webUrl: client.webUrl,
                mode: isCloud ? "cloud" : "local",
              },
              projects: [],
              nextSteps: isCloud
                ? ["Talos Cloud is not reachable. Check your TALOS_API_URL and TALOS_API_KEY environment variables."]
                : [
                    "Talos is not running. Call talos_start to launch Docker containers.",
                    "Or run: docker compose up -d  in the talos repo directory.",
                  ],
            }),
          }],
        };
      }

      // Fetch all projects with their data in parallel
      const projects = await client.listProjects();

      const enriched = await Promise.all(
        projects.map(async (p) => {
          const [envs, bugs, overview] = await Promise.allSettled([
            client.listEnvironments(p.id),
            client.getBugs(p.id),
            client.getOverview(p.id),
          ]);

          const envList = envs.status === "fulfilled" ? envs.value : [];
          const bugList = bugs.status === "fulfilled" ? bugs.value : [];
          const ov = overview.status === "fulfilled" ? overview.value : null;

          // Fetch auth for each env
          const envsWithAuth = await Promise.all(
            envList.map(async (env) => {
              const auth = await client.getAuth(p.id, env.id).catch(() => null);
              return {
                id: env.id,
                name: env.name,
                baseUrl: env.base_url,
                isDefault: env.is_default,
                authMode: auth?.mode ?? "none",
              };
            }),
          );

          const openBugs = bugList.filter((b) => b.status === "open" || b.status === "in_progress");

          return {
            id: p.id,
            name: p.name,
            domain: p.domain ?? null,
            environments: envsWithAuth,
            openBugCount: openBugs.length,
            totalRuns: ov?.totalRuns ?? 0,
            passRate: ov?.passRate ?? 0,
            totalCostUsd: ov?.totalCostUsd ?? 0,
            webUrl: client.buildWebUrl(`/projects/${p.id}`),
          };
        }),
      );

      // Build actionable next steps
      const nextSteps: string[] = [];
      if (enriched.length === 0) {
        nextSteps.push(
          "No projects yet. Call talos_setup_project with your app name, URL, and auth config to get started.",
        );
      } else {
        for (const p of enriched) {
          if (p.openBugCount > 0) {
            nextSteps.push(
              `Project "${p.name}" has ${p.openBugCount} open bugs. Call talos_get_bugs with projectId="${p.id}" to review them.`,
            );
          }
        }
        if (nextSteps.length === 0) {
          nextSteps.push("All projects are healthy. Run talos_discover_flows to map your app's flows, or talos_run_test to test a specific flow.");
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            talos: "AI-powered browser testing platform. Use talos_setup_project to add a new app, talos_run_test to run AI tests.",
            connection: {
              isRunning: true,
              apiUrl: client.apiUrl,
              webUrl: client.webUrl,
              mode: isCloud ? "cloud" : "local",
            },
            projects: enriched,
            nextSteps,
            availableTools: [
              "talos_start / talos_stop — start/stop Docker (local mode only)",
              "talos_setup_project — create or reconfigure a project + environment + auth",
              "talos_list_projects — list all projects with key info",
              "talos_update_project — rename a project or change domain",
              "talos_add_environment — add staging/prod environment to a project",
              "talos_update_environment — change environment URL or name",
              "talos_update_auth — update authentication config for an environment",
              "talos_discover_flows — explore the app to discover and save its flows as tests",
              "talos_run_test — run an AI test agent (natural language intent or saved test)",
              "talos_list_runs — list recent test runs",
              "talos_get_run — get detailed steps + bugs (or discovered tests) for a specific run",
              "talos_get_bugs — list open bugs",
              "talos_update_bug — mark bug as resolved / wont_fix / reopen",
              "talos_list_tests — list or create saved reusable tests",
            ],
          }),
        }],
      };
    },
  );
}
