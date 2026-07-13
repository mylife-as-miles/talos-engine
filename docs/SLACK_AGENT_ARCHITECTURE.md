# Slack Agent Architecture

```mermaid
graph TD
  Slack[Slack DM or mention] --> Agent[apps/slack-agent]
  Agent -->|MCP stdio| MCP[packages/mcp]
  MCP --> Client[@talosai/client]
  Client --> API[Talos API / queue / browser worker]
  API -->|SSE /api/runs/:runId/stream| Agent
  Agent -->|thread updates + report| Slack
```

```mermaid
sequenceDiagram
  participant U as User
  participant S as Slack
  participant A as Slack Agent
  participant M as Talos MCP
  participant T as Talos API
  U->>S: @Talos test checkout on staging
  S->>A: app_mention/message.im
  A->>M: talos_list_projects, talos_list_tests
  A->>M: talos_run_test(wait:false)
  M->>T: start run
  M-->>A: runId, status, webUrl
  A-->>S: live run URL + buttons
  A->>T: GET /api/runs/:runId/stream
  T-->>A: plan/step/bug/done events
  A-->>S: throttled progress updates
  A->>M: talos_get_run(includeScreenshots:true)
  A-->>S: evidence-backed final report
```
