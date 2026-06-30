<p align="center">
  <img src="apps/web/public/logo/talos.png" width="80" alt="Talos" />
</p>

<h1 align="center">Talos</h1>

<p align="center">
  <strong>AI agents that test your web app and find bugs — no test scripts required.</strong>
</p>

<p align="center">
  <a href="https://github.com/talosai/talos/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/talosai"><img src="https://img.shields.io/npm/v/talosai.svg" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/MCP-compatible-8A2BE2" alt="MCP" />
  <a href="https://discord.gg/8npJXGWREM"><img src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white" alt="Discord" /></a>
</p>

<br />

Point Talos at your web app, pick an LLM provider, and let it loose. It crawls every route, runs intent-driven tests, and hands you a report of visual, functional, and UX bugs — with screenshots and bounding boxes. No selectors to write. No scripts to maintain.

<p align="center">
  <strong><a href="https://discord.gg/8npJXGWREM">👾 Join the Discord</a> — get help, share what you find, follow development.</strong>
</p>

<div align="center">
  <a href="https://youtu.be/XlHBvW5y2cI">
    <img src="https://img.youtube.com/vi/XlHBvW5y2cI/maxresdefault.jpg" width="800" alt="Watch the Talos demo" />
  </a>
</div>

---

## Quick Start

The fastest path: one command sets up everything.

```bash
npx talosai
```

The CLI wizard asks for your LLM provider and API key, generates a `docker-compose.yml`, and starts all services. Dashboard opens at `http://localhost:11111`.

**Manual Docker setup:**

```bash
cp .env.example .env
# Add at least one LLM key — see Configuration below
docker compose up -d
```

**Local development (no Docker):**

```bash
# Requires Node 20+, PostgreSQL 16+, Redis
npm install
DATABASE_URL=postgresql://talos:talos@localhost:11112/talos npm run migrate
npm run dev:api   # API + Dashboard → http://localhost:11111
```

---

## How It Works

**1. Scan** — Talos BFS-crawls your app and builds a map of every route, form, modal, and interaction.

**2. Plan** — For each route or saved test intent, a path-planning agent generates a sequence of steps to exercise that flow.

**3. Run** — A Navigator agent drives a real Playwright browser, observing the page via accessibility tree and screenshots. A Review Agent and Filmstrip Reviewer run in parallel, watching for visual and UX regressions.

**4. Report** — A Triage Agent deduplicates findings, filters false positives using memory from past runs, and outputs bugs categorized by type (visual / functional / UX) and severity — each with a screenshot and bounding box.

---

## Features

**App Discovery**
- BFS crawler maps all routes, links, forms, and modals
- Route health dashboard — clean / issues / stale / untested
- Depth and scope controls per project

**Autonomous Testing**
- Intent-driven tests: describe what to test in plain English
- Supports authenticated flows — form login, Clerk, Supabase, OAuth, API tokens
- Navigator agent uses accessibility tree + screenshots, not brittle CSS selectors
- Stagehand self-healing: when the DOM shifts, elements are found by intent

**Bug Detection**
- Visual bugs — layout breaks, rendering glitches, pixel regressions
- Functional bugs — broken flows, unexpected errors, failed assertions
- UX bugs — confusing copy, missing feedback, accessibility gaps
- Screenshot per bug with highlighted bounding box; URL, severity, and source agent

**Agent Memory**
- Learns successful navigation paths across runs
- Records known false positives, ignore regions, and bug patterns
- Confidence scoring with decay — memory stays fresh, not compounding

**Integrations**
- MCP server: run tests and triage bugs from Claude Code, Cursor, or any MCP-compatible IDE
- UiPath Test Cloud handoff: publish Talos agent runs into a configured UiPath Test Manager project/test set
- TypeScript client SDK for CI/CD and custom orchestration
- REST API + SSE streaming for real-time run progress

**LLM Flexibility**
- OpenRouter (recommended), OpenAI, Anthropic, Google Gemini
- Each agent role (Navigator, Review, Auxiliary, Stagehand) configurable independently
- Per-run token and cost tracking

---

## MCP — Run Talos from Your IDE

Install the MCP server and run tests without leaving your editor.

```bash
npx talosai   # select "Install MCP" during setup
```

Or add it manually to your MCP config:

```json
{
  "mcpServers": {
    "talos": {
      "command": "npx",
      "args": ["-y", "@talosai/mcp"],
      "env": { "TALOS_BASE_URL": "http://localhost:11111" }
    }
  }
}
```

Once connected, your AI assistant can scan your app, run tests, and triage bugs inline — no context switching.

**Available tools:** `talos_scan`, `talos_run_test`, `talos_get_bugs`, `talos_update_bug`, `talos_list_routes`, `talos_memory`, `talos_get_coverage`, and [20+ more](packages/mcp/README.md).

---

## UiPath Test Cloud

Talos can hand off completed agentic test runs to UiPath Test Cloud so Automation Cloud remains the enterprise execution and governance layer. After the browser agent finishes, the worker writes:

- `talos-run.json` with the run ID, environment, intent, steps, bugs, severity counts, video URL, and LLM metrics.
- `uipath-input.json` with UiPath Test Manager parameter overrides, including `TalosRunPayload`, `TalosRunId`, and status/count fields.
- `talos-junit.xml` with pass/fail evidence for tools that expect JUnit-style output.
- UiPath CLI logs under `data/uipath-test-cloud/<runId>/`.

Enable it with:

```bash
UIPATH_TEST_CLOUD_ENABLED=true
UIPATH_TEST_CLOUD_MODE=modern
UIPATH_CLI_PATH=uip
UIPATH_TEST_CLOUD_TEST_SET_KEY=<your-test-set-key> # e.g. DEMO:42
UIPATH_TEST_CLOUD_EXECUTION_TYPE=manual
UIPATH_TEST_CLOUD_WAIT=false
UIPATH_TEST_CLOUD_EXTRA_ARGS="--profile <your-uipath-profile>"
```

The default `modern` mode invokes the UiPath CLI with `tm testsets run --test-set-key <key> --input-path <file>` and passes the generated Talos payload as Test Manager parameter overrides. Manual executions are submitted asynchronously by default because they remain open for human review. Set `UIPATH_TEST_CLOUD_WAIT=true` for automated test sets that should block until completion. If your UiPath Labs tenant uses the older `uipcli`, set:

```bash
UIPATH_TEST_CLOUD_MODE=legacy
UIPATH_CLI_PATH=uipcli
UIPATH_ORCHESTRATOR_URL=https://cloud.uipath.com/<account>/<tenant>/orchestrator_
UIPATH_ORCHESTRATOR_TENANT=<tenant-name>
```

For lab-specific CLI syntax, use `custom` mode:

```bash
UIPATH_TEST_CLOUD_MODE=custom
UIPATH_TEST_CLOUD_ARGS='tm testsets run --test-set-key {testSetKey} --input-path {inputPath}'
```

This is the recommended hackathon positioning for Track 3: Talos supplies the coding-agent testing layer, while UiPath Test Cloud receives the governed execution record, runs the configured test set, and keeps the process visible in Automation Cloud.

For Devpost, demo, and judging materials, see [docs/uipath-agenthack-submission.md](docs/uipath-agenthack-submission.md).

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://talos:talos@localhost:11112/talos` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | — | OpenRouter key (routes to all models — recommended) |
| `OPENAI_API_KEY` | — | Direct OpenAI key |
| `ANTHROPIC_API_KEY` | — | Direct Anthropic key |
| `GEMINI_API_KEY` | — | Direct Google Gemini key |
| `AGENT_MODEL` | `claude-haiku-4-5` | Model for browser navigation decisions |
| `AUXILIARY_MODEL` | `gemini-2.5-pro` | Crawl, path planning, memory curation, summarization |
| `REVIEW_AGENT_MODEL` | `claude-sonnet-4-6` | Post-run holistic and filmstrip screenshot analysis |
| `STAGEHAND_ENABLED` | `true` | Enable Stagehand for semantic element finding |
| `RUN_TIMEOUT_MINUTES` | `15` | Max wall-clock time per test run |
| `UIPATH_TEST_CLOUD_ENABLED` | `false` | Publish completed Talos runs to UiPath Test Cloud |
| `UIPATH_TEST_CLOUD_MODE` | `modern` | UiPath CLI mode: `modern`, `legacy`, or `custom` |
| `UIPATH_CLI_PATH` | `uip` | UiPath CLI executable |
| `UIPATH_TEST_CLOUD_PROJECT_KEY` | — | Optional UiPath Test Manager project key for custom/legacy modes |
| `UIPATH_TEST_CLOUD_TEST_SET_KEY` | — | UiPath Test Cloud/Test Manager test set key |
| `UIPATH_TEST_CLOUD_EXECUTION_TYPE` | `manual` | Test Manager execution type: `manual`, `automated`, or `mixed` |
| `UIPATH_TEST_CLOUD_WAIT` | `false` | Whether the worker waits for the UiPath execution to finish |
| `UIPATH_TEST_CLOUD_EXTRA_ARGS` | — | Extra CLI args such as profile, folder, or auth settings |

All model settings are also configurable via the dashboard under **Settings**.

---

## Architecture

```
packages/
  engine/     — Core agent loop, LLM client, crawler, memory, bug triage
  db/         — PostgreSQL storage adapter (StorageAdapter interface)
  talos/       — CLI setup wizard (npx talosai)
  mcp/        — Model Context Protocol server (@talosai/mcp)
  client/     — TypeScript HTTP client SDK (@talosai/client)

apps/
  api/        — Fastify HTTP server
  web/        — React dashboard
  worker/     — Test run executor (BullMQ)
```

The engine is storage-agnostic via the `StorageAdapter` interface — PostgreSQL is the default, but other backends can be plugged in.

---

## Contributing

Issues and pull requests are welcome. Please open an issue to discuss large changes before starting work.

```bash
git clone https://github.com/talosai/talos
cd talos
npm install
cp .env.example .env
docker compose up postgres redis -d
npm run dev
```

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
