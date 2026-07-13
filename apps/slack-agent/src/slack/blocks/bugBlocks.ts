type KnownBlock = Record<string, any>;
import type { TalosBug } from '../../mcp/types.js';
import { sortBugsBySeverity } from '../../talos/runReport.js';
export function bugBlocks(bugs:TalosBug[],webUrl?:string):KnownBlock[]{return[{type:'section',text:{type:'mrkdwn',text:`*Discovered bugs*\n${sortBugsBySeverity(bugs).slice(0,8).map(b=>`• *${b.severity.toUpperCase()}* ${b.name} — ${b.description}`).join('\n')||'No bugs found.'}${webUrl?`\n\n<${webUrl}|Full Talos evidence>`:''}`}}]}
