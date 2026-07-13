import { describe,it,expect } from 'vitest';
import { mapRunEvent,shouldSendProgress } from '../talos/runEventMapper.js';
describe('runEventMapper',()=>{it('normalizes steps',()=>{expect(mapRunEvent({type:'step',step:{index:2,action:'click',target:'button',status:'ok'}})).toMatchObject({currentStep:'click button',browserSteps:3})}); it('throttles unchanged progress',()=>{const e={type:'progress' as const,currentStep:'A'}; expect(shouldSendProgress(e,e,1000,0)).toBe(false)})});
