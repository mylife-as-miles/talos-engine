#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TalosClient } from "@talosai/client";

import { registerStartTools } from "./tools/start.js";
import { registerStatusTool } from "./tools/status.js";
import { registerSetupTool } from "./tools/setup.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerAuthTool } from "./tools/auth.js";
import { registerAuditTool } from "./tools/audit.js";
import { registerDiscoverTool } from "./tools/discover.js";
import { registerRunTestTool } from "./tools/run.js";
import { registerRunsTool } from "./tools/runs.js";
import { registerRunDetailTool } from "./tools/runDetail.js";
import { registerBugsTool } from "./tools/bugs.js";
import { registerTestsTool } from "./tools/tests.js";
import { registerMemoryTool } from "./tools/memory.js";
import { registerSettingsTools } from "./tools/settings.js";

const apiUrl = process.env.TALOS_API_URL ?? "http://localhost:11111";
const webUrl = process.env.TALOS_WEB_URL ?? "http://localhost:11111";
const apiKey = process.env.TALOS_API_KEY;
const isCloud = Boolean(apiKey);

const client = new TalosClient({ apiUrl, webUrl, apiKey });

const server = new McpServer({
  name: "talos",
  version: "0.1.0",
});

// ── Lifecycle ───────────────────────────────────────────────────────────────
registerStartTools(server, client, isCloud);

// ── Orientation ─────────────────────────────────────────────────────────────
registerStatusTool(server, client, isCloud);

// ── Project & environment management ────────────────────────────────────────
registerSetupTool(server, client);
registerProjectTools(server, client);
registerAuthTool(server, client);
registerAuditTool(server, client);

// ── Testing ─────────────────────────────────────────────────────────────────
registerDiscoverTool(server, client);
registerRunTestTool(server, client);
registerRunsTool(server, client);     // includes talos_stop_run
registerRunDetailTool(server, client);

// ── Results & triage ────────────────────────────────────────────────────────
registerBugsTool(server, client);

// ── Test management ─────────────────────────────────────────────────────────
registerTestsTool(server, client);    // includes talos_update_test, talos_delete_test

// ── Agent memory ─────────────────────────────────────────────────────────────
registerMemoryTool(server, client);

// ── Settings ─────────────────────────────────────────────────────────────────
registerSettingsTools(server, client);

// ── Transport ───────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
