import { describe,expect,it } from 'vitest';
import { getConfig } from '../config.js';
describe('environment booleans',()=>{it('parses string false as false',()=>{expect(getConfig({SLACK_SOCKET_MODE:'false',SLACK_RTS_ENABLED:'false'}).SLACK_SOCKET_MODE).toBe(false);expect(getConfig({SLACK_SOCKET_MODE:'false',SLACK_RTS_ENABLED:'false'}).SLACK_RTS_ENABLED).toBe(false)});it('rejects non-boolean strings',()=>{expect(()=>getConfig({SLACK_SOCKET_MODE:'0'})).toThrow()})});
