import { TalosMcpError } from './types.js';
import { redact } from '../security/redact.js';
export function parseMcpResult<T=unknown>(result:any):T{const texts=(result?.content??[]).filter((c:any)=>c?.type==='text'&&typeof c.text==='string').map((c:any)=>c.text); const text=texts.join('\n').trim(); let parsed:any=text; if(text){try{parsed=JSON.parse(text)}catch{parsed=text}}
 if(result?.isError){const msg=typeof parsed==='object'&&parsed?.error?String(parsed.error):text||'Talos MCP tool failed'; throw new TalosMcpError(redact(msg), parsed)}
 if(typeof parsed==='object'&&parsed?.error) throw new TalosMcpError(redact(String(parsed.error)),parsed);
 return parsed as T}
