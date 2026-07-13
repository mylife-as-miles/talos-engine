import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
const manifest=JSON.parse(readFileSync(new URL('../../manifest.json',import.meta.url),'utf8'));
describe('Slack manifest',()=>{it('configures Agent View without invalid bot events',()=>{expect(manifest.features.agent_view.agent_description).toBeTruthy();expect(manifest.features.agent_view.suggested_prompts).toHaveLength(5);expect(manifest.features.app_home.messages_tab_enabled).toBe(true);expect(manifest.settings.event_subscriptions.bot_events).not.toContain('agent_view');expect(manifest.settings.event_subscriptions.bot_events).toEqual(['app_home_opened','app_context_changed','message.im','app_mention']);expect(manifest.oauth_config.scopes.bot).not.toContain('commands')})});
