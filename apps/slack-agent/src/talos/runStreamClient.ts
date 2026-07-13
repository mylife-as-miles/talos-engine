import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { logger } from '../logger.js';
import { mapRunEvent } from './runEventMapper.js';
import type { NormalizedRunEvent } from './types.js';

const sleep=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{const id=setTimeout(resolve,ms); signal.addEventListener('abort',()=>{clearTimeout(id); reject(new DOMException('Aborted','AbortError'))},{once:true})});
export class RunStreamClient{
  private controllers=new Set<AbortController>();
  private closed=false;
  constructor(private apiUrl:string,private apiKey?:string){}
  close(){this.closed=true; for(const controller of this.controllers)controller.abort(); this.controllers.clear()}
  async stream(runId:string,onEvent:(event:NormalizedRunEvent)=>Promise<void>|void):Promise<void>{
    let attempt=0,lastId:string|undefined,terminal=false;
    while(!this.closed&&!terminal&&attempt<5){
      const controller=new AbortController(); this.controllers.add(controller);
      let eventQueue=Promise.resolve();
      try{
        const response=await fetch(`${this.apiUrl}/api/runs/${runId}/stream`,{headers:{...(this.apiKey?{Authorization:`Bearer ${this.apiKey}`}:{})},...(lastId?{'Last-Event-ID':lastId}:{}),signal:controller.signal});
        if(!response.ok)throw new Error(`SSE ${response.status}`);
        const parser=createParser({onEvent:(message:EventSourceMessage)=>{
          lastId=message.id||lastId;
          let event:NormalizedRunEvent|null;
          try{event=mapRunEvent(JSON.parse(message.data))}catch(error){logger.warn('Ignoring malformed Talos SSE event',{runId,error}); return}
          if(!event)return;
          if(event.terminal){if(terminal)return; terminal=true; controller.abort()}
          eventQueue=eventQueue.then(()=>Promise.resolve(onEvent(event!))).catch(error=>logger.warn('Talos SSE event callback failed',{runId,error}));
        }});
        const decoder=new TextDecoder();
        try{for await(const chunk of response.body as any){parser.feed(decoder.decode(chunk,{stream:true})); if(terminal)break}}catch(error){if(!terminal&&!this.closed)throw error}
        parser.feed(decoder.decode());
        await eventQueue;
        if(terminal)break;
        throw new Error('Talos SSE connection ended before terminal event');
      }catch(error){
        if(terminal||this.closed||(error instanceof DOMException&&error.name==='AbortError'))break;
        attempt++;
        logger.warn('Talos SSE connection interrupted; retrying',{runId,attempt,error});
        try{await sleep(Math.min(1000*2**attempt,15_000),controller.signal)}catch{break}
      }finally{this.controllers.delete(controller);controller.abort()}
    }
  }
}
