import { describe,it,expect } from 'vitest';
import { InMemoryRunThreadStore } from '../state/InMemoryRunThreadStore.js';
describe('dedupe and actions support',()=>{it('deduplicates Slack event ids',async()=>{const s=new InMemoryRunThreadStore(); expect(await s.dedupe('e')).toBe(true); expect(await s.dedupe('e')).toBe(false)}); it('preserves rerun parameters in store',async()=>{const s=new InMemoryRunThreadStore(); await s.save({runId:'r',channelId:'c',threadTs:'t',userId:'u',projectId:'p',environmentId:'e',intent:'i',startedAt:'now'}); expect((await s.get('r'))?.intent).toBe('i')})});
