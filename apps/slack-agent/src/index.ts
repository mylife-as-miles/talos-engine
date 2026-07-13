import { getConfig } from './config.js';
import { logger } from './logger.js';
import { createSlackApp } from './slack/createSlackApp.js';
import { registerEvents } from './slack/registerEvents.js';
import { registerActions } from './slack/registerActions.js';
import { registerCommands } from './slack/registerCommands.js';
import { TalosMcpClient } from './mcp/TalosMcpClient.js';
import { RunStreamClient } from './talos/runStreamClient.js';
import { InMemoryRunThreadStore } from './state/InMemoryRunThreadStore.js';
import { RedisRunThreadStore } from './state/RedisRunThreadStore.js';
async function main(){const config=getConfig(); if(!config.SLACK_BOT_TOKEN||!config.SLACK_SIGNING_SECRET||(config.SLACK_SOCKET_MODE&&!config.SLACK_APP_TOKEN)) throw new Error('Missing Slack credentials'); const app=createSlackApp(config); const mcp=new TalosMcpClient(config); await mcp.connect(); const store: import('./state/RunThreadStore.js').RunThreadStore=config.REDIS_URL?new RedisRunThreadStore(config.REDIS_URL):new InMemoryRunThreadStore(); const stream=new RunStreamClient(config.TALOS_API_URL,config.TALOS_API_KEY); registerEvents(app,{mcp,store,stream}); registerActions(app,{mcp,store}); registerCommands(app); const shutdown=async()=>{logger.info('Shutting down Slack agent'); stream.close(); await mcp.close(); await store.close?.(); await app.stop(); process.exit(0)}; process.on('SIGINT',()=>void shutdown()); process.on('SIGTERM',()=>void shutdown()); await app.start(config.PORT); logger.info('Talos Release Commander started',{socketMode:config.SLACK_SOCKET_MODE,port:config.PORT});}
main().catch(e=>{logger.error('Fatal startup error',{error:e}); process.exit(1)});
