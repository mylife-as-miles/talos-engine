import 'dotenv/config';
import { z } from 'zod';
export const strictBoolean=z.preprocess(value=>{
  if(value===true||value===false)return value;
  if(value==='true')return true;
  if(value==='false')return false;
  return value;
},z.boolean());
const Env=z.object({SLACK_SOCKET_MODE:strictBoolean.default(true),SLACK_APP_TOKEN:z.string().optional(),SLACK_BOT_TOKEN:z.string().optional(),SLACK_SIGNING_SECRET:z.string().optional(),PORT:z.coerce.number().default(3000),TALOS_MCP_COMMAND:z.string().default('node'),TALOS_MCP_ARGS:z.string().default('../../packages/mcp/dist/index.js'),TALOS_MCP_ARGS_JSON:z.string().optional(),TALOS_API_URL:z.string().url().default('http://localhost:11114'),TALOS_WEB_URL:z.string().url().default('http://localhost:11111'),TALOS_API_KEY:z.string().optional(),REDIS_URL:z.string().optional(),SLACK_RTS_ENABLED:strictBoolean.default(false)});
export type Config=z.infer<typeof Env>;
export function getConfig(env=process.env):Config{return Env.parse(env)}
export function parseMcpArgs(c:Config):string[]{ if(c.TALOS_MCP_ARGS_JSON){const v=JSON.parse(c.TALOS_MCP_ARGS_JSON); if(!Array.isArray(v)||!v.every(x=>typeof x==='string')) throw new Error('TALOS_MCP_ARGS_JSON must be a JSON string array'); return v;} return c.TALOS_MCP_ARGS.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(s=>s.replace(/^['"]|['"]$/g,''))??[]}
