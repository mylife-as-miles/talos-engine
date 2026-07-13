import { describe,it,expect } from 'vitest';
import { buildRunReport,sortBugsBySeverity } from '../talos/runReport.js';
import { runResultBlocks } from '../slack/blocks/runResultBlocks.js';
describe('run report blocks',()=>{it('blocks high severity failures',()=>{const r=buildRunReport({runId:'r',status:'passed',bugs:[{name:'Bug',description:'d',severity:'high'} as any]}); expect(r.verdict).toBe('BLOCKED')}); it('sorts severity',()=>{expect(sortBugsBySeverity([{name:'l',severity:'low'} as any,{name:'h',severity:'high'} as any])[0].name).toBe('h')}); it('generates block kit',()=>{expect(runResultBlocks({runId:'r',status:'passed',bugs:[],stepsCount:1} as any).length).toBeGreaterThan(1)})});
