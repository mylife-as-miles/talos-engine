import type { TalosMcpClient } from '../mcp/TalosMcpClient.js';
import type { TalosRun } from '../mcp/types.js';
import type { RunThreadStore } from '../state/RunThreadStore.js';
import { logger } from '../logger.js';
import { RunStreamClient } from './runStreamClient.js';
import { runStartedBlocks } from '../slack/blocks/runStartedBlocks.js';
import { runProgressBlocks } from '../slack/blocks/runProgressBlocks.js';
import { runResultBlocks,runResultText } from '../slack/blocks/runResultBlocks.js';

type SlackClient={chat:{postMessage(input:any):Promise<any>;update(input:any):Promise<any>}};
export type StartRunInput={teamId?:string;channelId:string;threadTs:string;userId:string;projectId:string;projectName:string;environmentId:string;environmentName:string;intent:string;testId?:string;label?:string};
const terminalStatuses=new Set(['passed','failed','stopped','completed','cancelled']);
const delay=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
export class StartAndMonitorRun{
  constructor(private deps:{mcp:TalosMcpClient;store:RunThreadStore;stream:RunStreamClient;monitoringTimeoutMs?:number;pollIntervalMs?:number}){}
  async start(input:StartRunInput,client:SlackClient){
    const run=await this.deps.mcp.runTest({projectId:input.projectId,environmentId:input.environmentId,intent:input.intent,testId:input.testId,wait:false});
    await this.deps.store.save({runId:run.runId,teamId:input.teamId,channelId:input.channelId,threadTs:input.threadTs,userId:input.userId,projectId:input.projectId,environmentId:input.environmentId,intent:input.intent,testId:input.testId,webUrl:run.webUrl,startedAt:new Date().toISOString()});
    await client.chat.postMessage({channel:input.channelId,thread_ts:input.threadTs,text:`${input.label??'Talos test'} started: ${run.runId}`,blocks:runStartedBlocks({project:input.projectName,environment:input.environmentName,intent:input.intent,status:run.status,runId:run.runId,webUrl:run.webUrl})});
    void this.monitor(run.runId,run.webUrl,input,client);
    return run;
  }
  private async terminalRun(runId:string):Promise<TalosRun|undefined>{
    const deadline=Date.now()+(this.deps.monitoringTimeoutMs??10*60_000);
    while(Date.now()<deadline){
      try{const run=await this.deps.mcp.getRun(runId,true);if(terminalStatuses.has(run.status.toLowerCase()))return run}catch(error){logger.warn('Talos final status retrieval failed',{runId,error})}
      await delay(this.deps.pollIntervalMs??4_000);
    }
    return undefined;
  }
  private async monitor(runId:string,webUrl:string|undefined,input:StartRunInput,client:SlackClient){
    let progressTs:string|undefined,lastSent=0,bugs=0,interruptionPosted=false,finalizationAttempted=false;
    const finish=async()=>{if(finalizationAttempted)return;finalizationAttempted=true;const final=await this.terminalRun(runId);if(!final){if(!interruptionPosted){interruptionPosted=true;await client.chat.postMessage({channel:input.channelId,thread_ts:input.threadTs,text:'Talos monitoring was interrupted before the run reached a final state. The run is still active; check Talos or try again shortly.'}).catch(error=>logger.warn('Slack monitoring interruption notice failed',{runId,error}))}return}if(!await this.deps.store.markCompletedIfPending(runId))return;try{await client.chat.postMessage({channel:input.channelId,thread_ts:input.threadTs,text:runResultText(final),blocks:runResultBlocks(final)})}catch(error){logger.warn('Slack final report failed',{runId,error})}};
    try{await this.deps.stream.stream(runId,async event=>{
      if(event.type==='bug')bugs++;
      if(event.type==='progress'&&Date.now()-lastSent>=3500){lastSent=Date.now(); const message={channel:input.channelId,thread_ts:input.threadTs,text:'Talos run progress',blocks:runProgressBlocks({title:`Talos is testing ${input.projectName} — ${input.environmentName}`,currentStep:event.currentStep,browserSteps:event.browserSteps,bugsObserved:bugs,plan:event.plan})}; try{if(progressTs)await client.chat.update({...message,ts:progressTs});else progressTs=(await client.chat.postMessage(message)).ts as string}catch(error){logger.warn('Slack progress update failed',{runId,error})}}
      if(event.terminal||event.type==='done')await finish();
    });await finish();
    }catch(error){logger.warn('Talos monitoring failed',{runId,error});await finish()}
  }
}
