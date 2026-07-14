import { randomUUID } from 'node:crypto';
import type { App } from '@slack/bolt';
import type { TalosMcpClient } from '../mcp/TalosMcpClient.js';
import type { RunThreadStore } from '../state/RunThreadStore.js';
import { resolveRunRequest } from '../talos/resolveRunRequest.js';
import { RunStreamClient } from '../talos/runStreamClient.js';
import { StartAndMonitorRun } from '../talos/startAndMonitorRun.js';
import { confirmationBlocks } from './blocks/confirmationBlocks.js';
import { errorBlocks } from './blocks/errorBlocks.js';
import { suggestedPrompts } from './suggestedPrompts.js';
import { logger } from '../logger.js';

export function registerEvents(app:App,deps:{mcp:TalosMcpClient;store:RunThreadStore;stream:RunStreamClient}){
  const lifecycle=new StartAndMonitorRun(deps);
  async function stopCurrent(event:any,body:any,client:any,channel:string,threadTs:string){
    const teamId=body?.team_id,userId=event.user;
    let active=await deps.store.findActiveByThread(teamId,channel,threadTs)??await deps.store.findActiveByChannel(teamId,channel);
    if(!active){const byUser=await deps.store.findActiveByUser(teamId,userId);if(byUser.length===1)active=byUser[0];else if(byUser.length>1){await client.chat.postMessage({channel,thread_ts:threadTs,text:`I found ${byUser.length} active Talos runs. Reply in the run thread to stop one: ${byUser.map(run=>run.runId).join(', ')}.`});return}}
    if(!active){await client.chat.postMessage({channel,thread_ts:threadTs,text:'No active Talos run was found.'});return}
    try{await deps.mcp.stopRun(active.runId);await client.chat.postMessage({channel,thread_ts:threadTs,text:`Stop requested for Talos run ${active.runId}.`})}catch(error){logger.warn('Talos stop request failed',{runId:active.runId,error});await client.chat.postMessage({channel,thread_ts:threadTs,text:'Talos could not stop the run. Please check the Talos console and try again.'})}
  }
  async function handle({event,client,body}:any){
    if(!event?.user||event.bot_id||event.subtype||!event.text?.trim())return;
    const eventId=body?.event_id??`${event.channel}:${event.ts}`; if(!await deps.store.dedupe(`event:${eventId}`))return;
    const channel=event.channel,threadTs=event.thread_ts??event.ts,text=event.text.trim();
    const isStopCommand=/^(?:<@[^>]+>\s*)?(?:please\s+)?(?:stop|cancel)(?:\s+(?:the|my|current|active))?\s+(?:test|run)\s*[.!]?$/i.test(text);
    if(isStopCommand){await stopCurrent(event,body,client,channel,threadTs);return}
    try{const projects=await deps.mcp.listProjects();const testsByProject=new Map();for(const project of projects)testsByProject.set(project.id,await deps.mcp.listTests(project.id).catch(()=>[]));const resolved=resolveRunRequest({text,projects,testsByProject});
      if(resolved.kind!=='resolved'){await client.chat.postMessage({channel,thread_ts:threadTs,text:resolved.message,blocks:errorBlocks(resolved.message)});return}
      const input={teamId:body?.team_id,channelId:channel,threadTs,userId:event.user,projectId:resolved.project.id,projectName:resolved.project.name,environmentId:resolved.environment.id,environmentName:resolved.environment.name,intent:resolved.intent,testId:resolved.test?.id};
      if(resolved.requiresConfirmation){const id=randomUUID();await deps.store.savePending({...input,id,baseUrl:resolved.environment.baseUrl},300);await client.chat.postMessage({channel,thread_ts:threadTs,text:'Production-like Talos run requires confirmation.',blocks:confirmationBlocks({project:input.projectName,environment:input.environmentName,baseUrl:resolved.environment.baseUrl,intent:input.intent,id})});return}
      await lifecycle.start(input,client);
    }catch(error){logger.error('Talos request failed',{error});await client.chat.postMessage({channel,thread_ts:threadTs,text:'Talos could not start the run. Check agent logs.',blocks:errorBlocks('Talos could not start the run. Check agent logs.')})}
  }
  app.event('app_mention',handle);
  app.event('message',async(args:any)=>{if(args.event.channel_type==='im')await handle(args)});
  app.event('app_home_opened',async({event,body,client}:any)=>{if(event.tab!=='messages'||!await deps.store.dedupe(`onboarding:${body?.team_id}:${event.user}`,60*60*24*30))return;try{await client.assistant.threads.setSuggestedPrompts({channel_id:event.channel,title:'How can Talos help?',prompts:suggestedPrompts.map(message=>({title:message,message}))})}catch(error){logger.warn('Could not set Talos suggested prompts',{error})}});
  return lifecycle;
}
