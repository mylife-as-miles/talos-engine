import { describe,expect,it } from 'vitest';
import { safeSlackUrl,SLACK_SECTION_TEXT_LIMIT,truncateSlackText } from '../slack/blocks/safety.js';
describe('Slack payload safety',()=>{it('truncates section text',()=>expect(truncateSlackText('x'.repeat(SLACK_SECTION_TEXT_LIMIT+1))).toHaveLength(SLACK_SECTION_TEXT_LIMIT));it('rejects unsafe URLs',()=>{expect(safeSlackUrl('javascript:alert(1)')).toBeUndefined();expect(safeSlackUrl('https://talos.example/run')).toBe('https://talos.example/run')})});
