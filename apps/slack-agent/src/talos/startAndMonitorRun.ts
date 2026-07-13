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
export class StartAndMonitorRun{
  constructor(private deps:{mcp:TalosMcpClient;store:RunThreadStore;stream:RunStreamClient}){}
  async start(input:StartRunInput,client:SlackClient){
    const run=await this.deps.mcp.runTest({projectId:input.projectId,environmentId:input.environmentId,intent:input.intent,testId:input.testId,wait:false});
    await this.deps.store.save({runId:run.runId,teamId:input.teamId,channelId:input.channelId,threadTs:input.threadTs,userId:input.userId,projectId:input.projectId,environmentId:input.environmentId,intent:input.intent,testId:input.testId,webUrl:run.webUrl,startedAt:new Date().toISOString()});
    await client.chat.postMessage({channel:input.channelId,thread_ts:input.threadTs,text:`${input.label??'Talos test'} started: ${run.runId}`,blocks:runStartedBlocks({project:input.projectName,environment:input.environmentName,intent:input.intent,status:run.status,runId:run.runId,webUrl:run.webUrl})});
    void this.monitor(run.runId,run.webUrl,input,client);
    return run;
  }
  private async monitor(runId:string,webUrl:string|undefined,input:StartRunInput,client:SlackClient){
    let progressTs:string|undefined,lastSent=0,bugs=0;
    const finish=async(status?:string)=>{
      if(!await this.deps.store.markCompletedIfPending(runId))return;
      let final:TalosRun;
      try{final=await this.deps.mcp.getRun(runId,true)}catch(error){logger.warn('Final Talos MCP retrieval failed',{runId,error}); final={runId,status:status??'unknown',summary:'Run completed, but Talos details are temporarily unavailable.',webUrl};}
      try{await client.chat.postMessage({channel:input.channelId,thread_ts:input.threadTs,text:runResultText(final),blocks:runResultBlocks(final)})}catch(error){logger.warn('Slack final report failed',{runId,error})}
    };
    try{await this.deps.stream.stream(runId,async event=>{
      if(event.type==='bug')bugs++;
      if(event.type==='progress'&&Date.now()-lastSent>=2500){lastSent=Date.now(); const message={channel:input.channelId,thread_ts:input.threadTs,text:'Talos run progress',blocks:runProgressBlocks({title:`Talos is testing ${input.projectName} — ${input.environmentName}`,currentStep:event.currentStep,browserSteps:event.browserSteps,bugsObserved:bugs,plan:event.plan})}; try{if(progressTs)await client.chat.update({...message,ts:progressTs});else progressTs=(await client.chat.postMessage(message)).ts as string}catch(error){logger.warn('Slack progress update failed',{runId,error})}}
      if(event.terminal||event.type==='done')await finish(event.status);
    });
    // A disconnect without a terminal event still gets one MCP final lookup and report.
    await finish();
    }catch(error){logger.warn('Talos monitoring failed',{runId,error}); await finish()}
  }
}
