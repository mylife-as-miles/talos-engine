import { redact } from './security/redact.js';
type L='debug'|'info'|'warn'|'error';
function log(level:L,msg:string,ctx?:Record<string,unknown>){const line={level,time:new Date().toISOString(),msg,...ctx}; console[level==='debug'?'log':level](redact(line));}
export const logger={debug:(m:string,c?:Record<string,unknown>)=>log('debug',m,c),info:(m:string,c?:Record<string,unknown>)=>log('info',m,c),warn:(m:string,c?:Record<string,unknown>)=>log('warn',m,c),error:(m:string,c?:Record<string,unknown>)=>log('error',m,c)};
