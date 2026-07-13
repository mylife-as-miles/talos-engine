import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Config } from '../config.js';
import { parseMcpArgs } from '../config.js';
import { mcpChildEnv } from './TalosMcpProcess.js';
import { parseMcpResult } from './parseMcpResult.js';
import type { TalosProject,TalosRun,TalosRunStart,TalosTest } from './types.js';
export class TalosMcpClient{private client:Client; private transport?:StdioClientTransport; constructor(private config:Config){this.client=new Client({name:'talos-slack-agent',version:'0.1.0'});} async connect(){this.transport=new StdioClientTransport({command:this.config.TALOS_MCP_COMMAND,args:parseMcpArgs(this.config),env:{...Object.fromEntries(Object.entries(process.env).filter((e): e is [string,string] => typeof e[1] === 'string')),...mcpChildEnv(this.config)}}); await this.client.connect(this.transport);} async close(){await this.client.close().catch(()=>undefined)} private async call<T>(name:string,args:Record<string,unknown>={}){return parseMcpResult<T>(await this.client.callTool({name,arguments:args}))}
 listProjects(){return this.call<{projects:TalosProject[]}>('talos_list_projects').then(r=>r.projects??[])}
 listTests(projectId:string){return this.call<{tests:TalosTest[]}>('talos_list_tests',{projectId,action:'list'}).then(r=>r.tests??[])}
 runTest(input:{projectId:string;environmentId?:string;intent?:string;testId?:string;wait?:boolean}){return this.call<TalosRunStart>('talos_run_test',{...input,wait:false})}
 getRun(runId:string,includeScreenshots=true){return this.call<TalosRun>('talos_get_run',{runId,includeScreenshots})}
 stopRun(runId:string){return this.call<{stopped:boolean;runId:string;message:string}>('talos_stop_run',{runId})}
 listRuns(projectId:string,status='all',limit=10){return this.call<{runs:TalosRun[]}>('talos_list_runs',{projectId,status,limit}).then(r=>r.runs??[])}
 getBugs(projectId:string,filters:Record<string,unknown>={}){return this.call<{bugs:unknown[]}>('talos_get_bugs',{projectId,...filters}).then(r=>r.bugs??[])} }
