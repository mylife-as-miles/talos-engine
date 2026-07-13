# Talos Release Commander

Slack control room for Talos browser tests. Users DM or mention `@Talos` to start, stop, rerun, and inspect Talos runs while execution, evidence, bugs, screenshots, and storage remain in Talos.

## Architecture
Slack events are handled by `apps/slack-agent`, which invokes `packages/mcp` over stdio with the official MCP TypeScript client. Runs start via `talos_run_test` with `wait:false`; live progress streams from `GET /api/runs/:runId/stream`; final details come from `talos_get_run`.

## Setup
1. Build MCP: `npm run build --workspace=@talosai/mcp`.
2. Create a Slack app from `manifest.json`.
3. Copy `.env.example` to `.env` and set Slack tokens/secrets.
4. Start Talos API/worker/web: `npm run dev`.
5. Start the agent: `npm run dev:slack`.

## Modes
Socket Mode: set `SLACK_SOCKET_MODE=true`, `SLACK_APP_TOKEN`, `SLACK_BOT_TOKEN`, and `SLACK_SIGNING_SECRET`.
Hosted Events API: set `SLACK_SOCKET_MODE=false`, `PORT`, `SLACK_BOT_TOKEN`, and `SLACK_SIGNING_SECRET`.

## Demo
Open the Talos Slack agent and send: `Test the checkout UI on staging. Verify that a customer can add a product, apply a discount and complete payment.` Talos resolves project/environment, starts a run, posts the live URL, streams progress, and posts a BLOCKED/READY report with evidence. Use buttons to stop, rerun, open evidence, or show bugs.

## Security
Secrets are redacted from logs and Slack-facing errors. Only `http:` and `https:` evidence links are rendered. Production-like environments require confirmation (current implementation posts a confirmation-required message rather than silently running).

## Troubleshooting
If MCP startup fails, verify `TALOS_MCP_COMMAND` and `TALOS_MCP_ARGS_JSON`. If Slack updates fail, the Talos run continues and errors are logged with run/thread correlation. Redis is optional; set `REDIS_URL` to persist run-thread mappings across restarts.

## Known limitations
Real-Time Search is feature-flagged and not implemented in the core flow. Production confirmation is conservative and can be extended to a modal in a follow-up.
