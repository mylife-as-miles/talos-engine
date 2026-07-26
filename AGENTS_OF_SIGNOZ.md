# Talos Observability

## Agents of SigNoz submission

**Track:** AI & Agent Observability

**One-line pitch:** Talos is a black-box recorder for autonomous browser-testing agents. It correlates every API request, queue transition, browser decision, LLM call, network failure, bug, log, token, cost, and run outcome in SigNoz through OpenTelemetry.

## Problem

AI browser agents are difficult to debug because one user-visible test crosses several independent systems:

- A dashboard, Slack agent, or MCP client starts the test.
- The Fastify API validates and enqueues it.
- BullMQ and Redis deliver it to a separate worker.
- The worker launches Playwright or Stagehand.
- Several navigator and review agents call different LLM providers.
- Browser actions trigger application APIs that can fail independently.
- PostgreSQL persists steps, bugs, costs, screenshots, and final results.

Without cross-service observability, a failed test appears as a generic blocked or failed run. Engineers cannot quickly distinguish an LLM problem, queue delay, browser action failure, target-application error, database issue, or infrastructure bottleneck.

## Solution

Talos emits standard OpenTelemetry data to SigNoz:

```text
talos-slack-agent (optional)
        |
        v
     talos-mcp
        |
        v
     talos-api
        |
        v
 BullMQ / Redis
        |
        v
   talos-worker
        |
        +-- talos.agent.run
        +-- gen_ai.chat
        +-- browser action events
        +-- browser network error events
        +-- review and bug signals
        +-- PostgreSQL / Redis / HTTP spans
```

SigNoz then provides:

- End-to-end traces for every Talos run.
- Correlated Pino logs.
- Agent, LLM, cost, token, QA, and network metrics.
- Query Builder analysis across traces, metrics, and logs.
- Dashboards for run health, LLM operations, and QA reliability.
- Alerts for failed or stalled runs, LLM degradation, cost spikes, browser API failures, and missing telemetry.
- MCP-powered investigation that lets an AI assistant inspect live SigNoz evidence rather than guessing from an application error message.

## Pre-existing Talos foundation

The following existed before Agents of SigNoz:

- React and Vite web dashboard.
- Fastify API.
- BullMQ and Redis run queue.
- PostgreSQL storage.
- Playwright and Stagehand browser execution.
- Navigator, review, bug-triage, flow-discovery, and memory agents.
- LLM call, token, cost, screenshot, step, and bug persistence.
- Talos MCP server and TypeScript client.
- Slack Release Commander.
- UiPath Test Cloud export.

## Built for Agents of SigNoz

The hackathon branch adds:

- OpenTelemetry Node bootstrap and OTLP export.
- Official Fastify route and handler instrumentation.
- BullMQ producer-to-consumer trace propagation.
- Separate service identities for API, worker, Slack agent, and MCP.
- A `talos.agent.run` span around the browser-agent lifecycle.
- Provider-neutral `gen_ai.chat` spans for OpenAI, Anthropic, Gemini, and OpenRouter calls.
- Metrics for runs, duration, steps, LLM calls, latency, tokens, costs, network failures, and bugs.
- Trace events for agent steps, plans, activity, browser network failures, run completion, and crashes.
- Explicit protection against prompt, completion, credential, screenshot, and DOM export.
- Foundry `casting.yaml` with the SigNoz MCP server enabled.
- Reproducible setup, verification, dashboard, alert, IAM, and demo documentation.

## Privacy design

Talos exports operational metadata only. The default configuration explicitly disables GenAI message-content capture. Credentials, cookies, prompts, completions, tool arguments, screenshots, DOM content, accessibility trees, form values, and API keys stay out of observability telemetry.

High-cardinality identifiers are allowed on spans and logs where they are needed for investigation. They are intentionally excluded from metric labels.

## Demo

1. Start a checkout test from Talos MCP, the dashboard, or Slack.
2. The API enqueues the test and BullMQ propagates the active trace context.
3. The worker launches the browser agent and calls one or more LLM providers.
4. The target checkout API intentionally returns HTTP 500.
5. Talos records the action-correlated network failure and marks the run blocked or failed.
6. A SigNoz alert fires.
7. SigNoz MCP finds the run trace, slowest operations, error logs, failed browser request, token/cost impact, and related recent runs.
8. The final investigation report identifies the likely failure source and links its conclusion to observable evidence.

## Local setup

```bash
# Generate the dependency and Foundry lock files, then build every workspace.
npm run signoz:finalize

# Deploy SigNoz and its MCP server.
foundryctl cast -f casting.yaml

# Start the observed Talos API, worker, and web app.
npm run dev:observed

# Include the optional Slack agent and its Talos MCP child process.
TALOS_OBSERVE_SLACK=true npm run dev:observed
```

See [`docs/signoz-observability.md`](docs/signoz-observability.md) for the full runbook.
