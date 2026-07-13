import { describe,it,expect } from 'vitest';
import { redact } from '../security/redact.js';
describe('redact',()=>{it('redacts secrets',()=>{expect(redact('Authorization: Bearer abc.def password=secret xoxb-123')).not.toMatch(/abc\.def|secret|xoxb-123/)})});
