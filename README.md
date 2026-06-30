# Talos Test Cloud Agent

Agentic QA orchestration for UiPath Test Cloud.

Talos runs browser-based testing agents against real web applications, captures
evidence-rich execution traces, and prepares those results for UiPath Test
Cloud / Test Manager so agentic QA can live inside an enterprise-governed
testing workflow.

## Why Talos Exists

Modern teams ship faster than traditional manual QA can comfortably follow.
AI agents can explore software quickly, but raw autonomous browser sessions are
not enough for enterprise testing. Teams need traceability, evidence, review,
repeatability, and a clear place where test outcomes are governed.

Talos was built around that gap.

It gives testers a browser agent that can log in, navigate flows, observe page
state, record steps, and surface issues, while keeping UiPath Test Cloud as the
enterprise testing layer that owns execution context, test sets, review, and
governance.

## What It Does

Talos lets you describe a test goal in plain language, then turns that goal into
a live browser test run.

It can:

- Launch a real browser against a target application.
- Authenticate through configured login flows.
- Navigate screens using semantic page understanding.
- Capture step-by-step execution evidence.
- Record LLM calls, costs, screenshots, observations, and issues.
- Stream live run progress to the web dashboard.
- Preserve run history for review and debugging.
- Publish completed run artifacts for UiPath Test Cloud handoff.

Talos is especially useful for:

- Exploratory QA.
- Smoke testing.
- Flow discovery.
- Regression test drafting.
- AI-assisted test triage.
- Human-in-the-loop quality review.
- UiPath AgentHack Track 3 submissions focused on Test Cloud.

## UiPath Test Cloud Focus

Talos is designed for **UiPath AgentHack Track 3: UiPath Test Cloud**.

The core idea is simple:

**Talos supplies the agentic browser-testing layer. UiPath Test Cloud supplies
the enterprise execution, orchestration, and governance layer.**

When a Talos run completes, the worker can generate UiPath-ready artifacts under
`data/uipath-test-cloud/<runId>/`, including:

- `talos-run.json` with run metadata, intent, steps, issue counts, model usage,
  cost, environment, and evidence references.
- `uipath-input.json` with Test Manager parameter overrides such as
  `TalosRunPayload`, `TalosRunId`, status fields, and issue counts.
- `talos-junit.xml` for systems that consume JUnit-style pass/fail output.
- CLI logs from the UiPath Test Cloud handoff attempt.

This means Talos does not treat an AI agent run as a disposable demo. It turns
the run into structured testing evidence that can be associated with a UiPath
Test Manager project, test set, and test case workflow.

## How The Workflow Fits Together

1. A tester creates or selects a Talos project.
2. The tester configures an environment, target URL, and optional credentials.
3. The tester describes the desired test flow in natural language.
4. Talos creates a run and queues it for the worker.
5. The worker launches a browser and executes the agentic test.
6. The agent observes the application, performs actions, and records evidence.
7. Talos streams progress to the dashboard while persisting durable run data.
8. A human reviewer inspects the run, steps, screenshots, and issues.
9. Talos prepares UiPath Test Cloud artifacts for governed test execution.
10. UiPath Test Cloud becomes the control layer for enterprise QA visibility.

## Key Features

### Agentic Browser Testing

- Natural-language test goals.
- Real browser execution through Playwright.
- Authenticated application testing.
- Step-by-step reasoning and execution traces.
- DOM and accessibility-tree informed navigation.
- Screenshot and visual evidence support.

### Human Review

- Run detail timeline.
- Live progress panel.
- Captured LLM calls.
- Cost tracking.
- Issue review.
- Run history.
- Evidence-first debugging when a flow is blocked.

### UiPath Test Cloud Handoff

- Optional UiPath publishing after a run completes.
- Test Manager project/test set configuration.
- Modern, legacy, and custom UiPath CLI modes.
- Generated JSON and JUnit artifacts.
- Manual or automated execution mode.
- Async or blocking execution depending on `UIPATH_TEST_CLOUD_WAIT`.

### Enterprise-Oriented Architecture

- API and worker are separated.
- Runs execute through a Redis-backed queue.
- PostgreSQL stores durable project, environment, test, and run data.
- Live progress is streamed while historical data remains reviewable.
- Model settings can be configured through the dashboard.

## Tech Stack

- **Frontend:** React, TypeScript, Vite.
- **API:** Fastify, TypeScript.
- **Worker:** BullMQ, Redis, Playwright, TypeScript.
- **Database:** PostgreSQL.
- **LLM providers:** OpenRouter, OpenAI, Anthropic, Google Gemini.
- **Testing orchestration target:** UiPath Test Cloud / Test Manager.
- **Automation interface:** MCP server and TypeScript client package.

## Repository Layout

```text
apps/
  api/        Fastify API server
  web/        React dashboard
  worker/     Background run executor

packages/
  client/     TypeScript HTTP client
  db/         PostgreSQL storage adapter and migrations
  engine/     Agent loop, browser automation, review, memory, orchestration
  mcp/        Model Context Protocol server
  talos/      CLI setup package
```

## Quick Start

### Prerequisites

- Node.js 20 or newer.
- Docker Desktop.
- At least one LLM API key.
- UiPath CLI access if enabling Test Cloud publishing.

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Postgres And Redis

```bash
docker compose up postgres redis -d
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Add at least one model provider key:

```bash
OPENROUTER_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

OpenRouter is the simplest option because it can route to multiple model
families from one key. Direct provider keys also work.

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Start The App

```bash
npm run dev
```

The dashboard runs at:

```text
http://localhost:11111
```

In local development, the API usually runs on:

```text
http://localhost:11114
```

## Recommended Demo Flow

For a reliable UiPath AgentHack demo, use a short, controlled testing intent
instead of a broad autonomous crawl.

Example:

```text
Log in, open Dashboard, open Chat, open Roles, observe each page, then finish.
```

This demonstrates the important pieces:

- Talos can launch a browser.
- Talos can authenticate.
- Talos can navigate real app screens.
- Talos can capture evidence.
- Talos can preserve step-by-step run history.
- Talos can prepare results for UiPath Test Cloud.

Avoid very broad prompts like "discover the entire application" during a short
demo. They are useful for exploration, but they can take longer and may get
stuck inside dynamic application behavior.

## UiPath Test Cloud Setup

Enable UiPath publishing in `.env`:

```bash
UIPATH_TEST_CLOUD_ENABLED=true
UIPATH_TEST_CLOUD_MODE=modern
UIPATH_CLI_PATH=uip
UIPATH_TEST_CLOUD_PROJECT_KEY=<your-project-key>
UIPATH_TEST_CLOUD_TEST_SET_KEY=<your-test-set-key>
UIPATH_TEST_CLOUD_EXECUTION_TYPE=manual
UIPATH_TEST_CLOUD_WAIT=false
UIPATH_TEST_CLOUD_EXTRA_ARGS="--profile <your-uipath-profile>"
```

### Modern Mode

Modern mode uses the current UiPath CLI:

```bash
UIPATH_TEST_CLOUD_MODE=modern
UIPATH_CLI_PATH=uip
```

Talos invokes the configured UiPath CLI with a Test Manager test-set execution
command and passes the generated Talos payload through an input file.

Use this mode for current UiPath Automation Cloud / Test Cloud environments.

### Legacy Mode

If your environment uses the older `uipcli`, configure:

```bash
UIPATH_TEST_CLOUD_MODE=legacy
UIPATH_CLI_PATH=uipcli
UIPATH_ORCHESTRATOR_URL=https://cloud.uipath.com/<account>/<tenant>/orchestrator_
UIPATH_ORCHESTRATOR_TENANT=<tenant-name>
UIPATH_TEST_CLOUD_PROJECT_KEY=<your-project-key>
UIPATH_TEST_CLOUD_TEST_SET_KEY=<your-test-set-key>
```

### Custom Mode

If your UiPath Labs tenant needs custom CLI syntax:

```bash
UIPATH_TEST_CLOUD_MODE=custom
UIPATH_TEST_CLOUD_ARGS='tm testsets run --test-set-key {testSetKey} --input-path {inputPath}'
```

Supported placeholders include:

- `{inputPath}`
- `{payloadPath}`
- `{junitPath}`
- `{resultPath}`
- `{runId}`
- `{status}`
- `{projectKey}`
- `{testSetKey}`
- `{tenant}`
- `{orchestratorUrl}`

## Important Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. |
| `REDIS_URL` | Redis connection string for the run queue and live state. |
| `OPENROUTER_API_KEY` | Recommended provider key for routing to multiple models. |
| `OPENAI_API_KEY` | Direct OpenAI model access. |
| `ANTHROPIC_API_KEY` | Direct Anthropic model access. |
| `GEMINI_API_KEY` | Direct Google Gemini model access. |
| `AGENT_MODEL` | Model used by the browser navigator. |
| `AUXILIARY_MODEL` | Model used for planning, discovery, memory, and summaries. |
| `REVIEW_AGENT_MODEL` | Model used for post-run review. |
| `STAGEHAND_ENABLED` | Enables semantic element finding support. |
| `RUN_TIMEOUT_MINUTES` | Maximum wall-clock runtime for a test. |
| `UIPATH_TEST_CLOUD_ENABLED` | Enables UiPath Test Cloud handoff. |
| `UIPATH_TEST_CLOUD_MODE` | `modern`, `legacy`, or `custom`. |
| `UIPATH_CLI_PATH` | UiPath CLI executable path or command. |
| `UIPATH_TEST_CLOUD_PROJECT_KEY` | UiPath Test Manager project key. |
| `UIPATH_TEST_CLOUD_TEST_SET_KEY` | UiPath Test Cloud/Test Manager test set key. |
| `UIPATH_TEST_CLOUD_WAIT` | Whether Talos waits for the UiPath execution to finish. |

Model settings can also be changed in the dashboard under **Settings**.

## MCP Usage

Talos includes an MCP server so coding agents and MCP-compatible tools can start
tests, inspect runs, and triage issues without leaving the development
environment.

Example MCP configuration:

```json
{
  "mcpServers": {
    "talos": {
      "command": "npx",
      "args": ["-y", "@talosai/mcp"],
      "env": {
        "TALOS_BASE_URL": "http://localhost:11111"
      }
    }
  }
}
```

Available tool areas include:

- Project and environment management.
- Test execution.
- Run detail inspection.
- Bug triage.
- Memory management.
- Coverage and discovery workflows.

## Development Commands

```bash
npm run dev
npm run dev:api
npm run dev:worker
npm run dev:web
npm run migrate
npm run build
```

If Playwright reports that Chromium is missing, install the browser runtime:

```bash
npx playwright install chromium
```

## Troubleshooting

### A run is stuck on "launching browser"

Install Playwright's browser runtime:

```bash
npx playwright install chromium
```

Then restart the worker.

### A broad discovery run stalls

Use a smaller controlled flow for demos and first-time validation. Broad
discovery can hit dynamic app states that take longer to resolve.

### The queue is blocked by an old run

Stop the run from the dashboard. If the worker is unresponsive, restart the
worker and verify Redis queue state before starting a new run.

### UiPath handoff does not appear

Check:

- `UIPATH_TEST_CLOUD_ENABLED=true`
- UiPath CLI is installed and authenticated.
- `UIPATH_TEST_CLOUD_TEST_SET_KEY` is set.
- The configured CLI profile can access the Test Manager project/test set.
- `data/uipath-test-cloud/<runId>/` contains generated artifacts or CLI logs.

## Hackathon Positioning

Talos is a UiPath Test Cloud project because it focuses on agentic software
testing.

It shows how coding agents, browser agents, and LLM-based review can improve
software QA while UiPath remains the enterprise control plane. The agent
explores and validates the application, but the final value comes from turning
that activity into governed Test Cloud evidence that a team can review,
understand, and build on.

## License

Apache 2.0. See [LICENSE](LICENSE).
