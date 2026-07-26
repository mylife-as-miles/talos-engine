# Talos Observability with SigNoz

Talos emits OpenTelemetry traces, metrics, and logs to SigNoz so an agent run can be followed from the API request, through BullMQ and Redis, into the worker, browser agent, LLM calls, network failures, review agents, and final result.

## Architecture

```text
Slack / Talos MCP / Dashboard
          |
          v
      talos-api
          |
          | BullMQ OpenTelemetry context
          v
      talos-worker
          |
          +-- talos.agent.run
          |    +-- gen_ai.chat spans
          |    +-- agent-step events
          |    +-- browser-network-error events
          |    +-- PostgreSQL / Redis / HTTP spans
          |
          +-- correlated Pino logs
          +-- custom agent and LLM metrics
          |
          v
    OTLP HTTP :4318
          |
          v
        SigNoz
   traces + metrics + logs
          |
          v
  SigNoz MCP :8000/mcp
```

The application only depends on OpenTelemetry. SigNoz is selected by the OTLP endpoint, not hard-coded into the engine.

## What is instrumented

### Automatic Node instrumentation

The API and worker preload `@opentelemetry/auto-instrumentations-node`. This covers the Node HTTP stack, OpenAI SDK, PostgreSQL, Redis/ioredis, Pino, process/runtime signals, and other supported libraries.

### BullMQ propagation

Both the API `Queue` and worker `Worker` use `bullmq-otel`. The producer serializes the active W3C trace context into the job metadata, and the worker restores it before processing. This keeps the enqueue and execution spans in one distributed trace.

### Talos domain instrumentation

The observed orchestration wrapper emits a `talos.agent.run` span and the following custom metrics:

| Metric | Type | Unit | Purpose |
|---|---|---|---|
| `talos.agent.runs.active` | UpDownCounter | `{run}` | Runs currently executing |
| `talos.agent.runs` | Counter | `{run}` | Completed runs by status/environment/trigger |
| `talos.agent.run.duration` | Histogram | `ms` | End-to-end run duration |
| `talos.agent.steps` | Counter | `{step}` | Browser steps by action/status/method |
| `talos.gen_ai.calls` | Counter | `{call}` | LLM calls by provider/model/agent/status |
| `talos.gen_ai.call.duration` | Histogram | `ms` | LLM latency |
| `talos.gen_ai.tokens` | Counter | `{token}` | Input and output token volume |
| `talos.gen_ai.cost` | Counter | `USD` | Estimated model cost |
| `talos.browser.network.errors` | Counter | `{error}` | Action-correlated browser API failures |
| `talos.qa.bugs` | Counter | `{bug}` | Bugs by severity/type/source |

High-cardinality values such as `runId`, `projectId`, and `testId` are attached to spans and logs only. They are intentionally excluded from metric dimensions.

## Privacy and security

Telemetry must never contain:

- Authentication credentials or cookies.
- LLM prompts or full responses.
- Screenshots, DOM content, or accessibility trees.
- User-provided form values.
- API keys or service-account credentials.
- Full target URLs containing query strings or fragments.

The custom instrumentation exports only operational metadata. Talos continues to store detailed evidence in its existing application data stores.

## 1. Deploy SigNoz with Foundry

The repository includes `casting.yaml` with the SigNoz MCP server enabled.

```bash
foundryctl gauge -f casting.yaml
foundryctl forge -f casting.yaml
foundryctl cast -f casting.yaml
```

`forge` writes `casting.yaml.lock`. Commit the generated lock file so judges can reproduce the exact rendered deployment.

Expected local endpoints:

- SigNoz UI: `http://localhost:8080`
- OTLP gRPC: `http://localhost:4317`
- OTLP HTTP: `http://localhost:4318`
- SigNoz MCP: `http://localhost:8000/mcp`

On Windows, run the SigNoz stack with the native Docker Engine inside WSL 2 rather than Docker Desktop's virtualization layer.

## 2. Start Talos with telemetry

### Docker Compose

The default Talos compose configuration sends OTLP HTTP data to `host.docker.internal:4318`:

```bash
docker compose up --build
```

Override the collector when necessary:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector.example:4318 docker compose up --build
```

### Native development

Start SigNoz first, then run:

```bash
npm install
npm run dev:observed
```

The observed launcher preloads the Node OTel SDK before Talos modules are imported. Loading the SDK after application imports can miss HTTP, Pino, PostgreSQL, Redis, and OpenAI instrumentation.

## 3. Verify ingestion before creating dashboards

Do not create dashboards or alerts until data is present. Run a controlled Talos test, then use SigNoz MCP to discover the exact fields and metric metadata in the live instance.

Required service names:

- `talos-api`
- `talos-worker`

Recommended verification sequence:

1. List services and confirm both names appear.
2. Search traces for `service.name = talos-worker` and operation `talos.agent.run`.
3. Confirm the trace includes BullMQ producer/consumer spans and downstream PostgreSQL, Redis, HTTP, and LLM spans.
4. Search logs for the same trace ID and confirm Pino records contain `trace_id` and `span_id`.
5. List metrics using the `talos.` prefix and inspect each metric's type, temporality, and available labels.
6. Validate one metric query for each planned dashboard panel.

Discovery must happen independently for traces, logs, and metrics because a field available on one signal may not exist on another.

## 4. Dashboard design

Create a custom dashboard after the verification sequence. Use `service.name` and `deployment.environment.name` as variables, and use the exact field names returned by SigNoz MCP.

### Section: Run health

- Active runs from `talos.agent.runs.active`.
- Run throughput from `talos.agent.runs` using `increase` over the selected interval.
- Success/failure ratio grouped by `talos.run.status`.
- P50/P95/P99 run duration from `talos.agent.run.duration`.
- BullMQ waiting/active/failed job metrics emitted by `bullmq-otel`.

### Section: Agent execution

- Steps by action from `talos.agent.steps`.
- Failed steps grouped by `talos.agent.action`.
- Execution method split: Stagehand, Playwright, coordinates.
- Trace table filtered to `talos.agent.run` with duration, status, environment, and run ID.

### Section: LLM operations

- LLM calls by provider/model/agent from `talos.gen_ai.calls`.
- P50/P95/P99 call latency from `talos.gen_ai.call.duration`.
- Input/output tokens from `talos.gen_ai.tokens` grouped by `gen_ai.token.type`.
- Cost over time from `talos.gen_ai.cost`.
- LLM error rate using failed calls divided by all calls.

### Section: QA signals

- Browser network errors from `talos.browser.network.errors`.
- Bugs by severity/type/source from `talos.qa.bugs`.
- Error-log trend for `service.name = talos-worker`.
- Recent failed runs with links into their traces.

Use per-interval `increase` for low-volume human-paced counters rather than rendering tiny per-second values. Use trace-derived metrics for long-window RED panels and alert evaluation where available.

## 5. Alerts

Create alerts only after probing the exact service and metric combination for data.

Recommended initial rules:

1. **Run failure rate**
   - Signal: metric formula.
   - Condition: failed runs / total runs above 20% over 10 minutes.
   - Severity: critical.

2. **Agent run stalled or silent**
   - Signal: absent data or active-run/run-completion mismatch.
   - Condition: an active run exists with no completion or step signal for five minutes.
   - Severity: critical.

3. **LLM error rate**
   - Signal: metric formula.
   - Condition: error calls / all calls above 10% over five minutes.
   - Severity: warning.

4. **LLM latency degradation**
   - Signal: metric histogram.
   - Condition: P95 `talos.gen_ai.call.duration` above the measured baseline.
   - Severity: warning.

5. **Model cost spike**
   - Signal: metric counter increase.
   - Condition: run or hourly cost exceeds the chosen budget.
   - Severity: warning.

6. **Browser API failures**
   - Signal: metric or logs.
   - Condition: repeated high-severity network failures in five minutes.
   - Severity: warning.

7. **Telemetry stopped arriving**
   - Signal: absent data for `service.name = talos-api` or `talos-worker`.
   - Severity: critical in production.

Use a five-minute evaluation window and one-minute frequency as starting values, then tune against real run volume. Include the resource scope, current value, threshold, owning team, and a real runbook link in alert annotations.

## 6. Host metrics

Foundry's OpenTelemetry Collector can collect CPU, memory, disk, network, process, and system metrics. Keep host/container identity separate from application identity and verify the join attribute before combining infrastructure panels with Talos services.

Do not assume `service.name` exists on host metrics. Discover and use `host.name`, `container.name`, or the actual workload attribute emitted by the deployment.

## 7. SigNoz MCP workflow

The SigNoz MCP endpoint is enabled by Foundry, but API keys are not stored in `casting.yaml` or source control.

1. Create a least-privilege SigNoz service account.
2. Create its API key and store it in the MCP client's secret store.
3. Connect the client to `http://localhost:8000/mcp` with the `SIGNOZ-API-KEY` request header.
4. Install the official `SigNoz/agent-skills` plugin in the coding-agent client.
5. Use Talos MCP to start or inspect a test and SigNoz MCP to investigate the resulting trace, logs, metrics, dashboards, and alerts.

Example investigation intent:

```text
Investigate Talos run <run-id>. Find its talos.agent.run trace, identify the
slowest agent/LLM/browser operations, correlate error logs and network-error
events, compare the run with recent successful runs in the same environment,
and return evidence-backed likely causes.
```

## 8. Demo scenario

Use one controlled checkout failure:

1. Start a test through the dashboard, Slack agent, or Talos MCP.
2. The API enqueues the job and BullMQ carries the active trace context.
3. The worker executes the browser agent and emits LLM, browser, DB, Redis, and HTTP telemetry.
4. The target app returns an intentional HTTP 500 during payment.
5. Talos records the network issue and the run fails or becomes blocked.
6. A SigNoz alert fires.
7. SigNoz MCP investigates the trace and correlated logs.
8. The final report explains the failing action, endpoint status, upstream agent decision, latency, token/cost impact, and recommended next action.

This demonstrates the full hackathon loop: observable agent execution, cross-signal diagnosis, dashboards, alerts, and AI-assisted investigation through SigNoz MCP.
