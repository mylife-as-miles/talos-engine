import type { Config } from '../config.js';

export function mcpChildEnv(config: Config): Record<string, string> {
  return {
    TALOS_API_URL: config.TALOS_API_URL,
    TALOS_WEB_URL: config.TALOS_WEB_URL,
    OTEL_SERVICE_NAME: 'talos-mcp',
    ...(config.TALOS_API_KEY ? { TALOS_API_KEY: config.TALOS_API_KEY } : {}),
  };
}
