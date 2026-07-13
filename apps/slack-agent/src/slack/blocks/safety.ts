export const SLACK_SECTION_TEXT_LIMIT=3000;
export function truncateSlackText(value:string,limit=SLACK_SECTION_TEXT_LIMIT){return value.length<=limit?value:`${value.slice(0,Math.max(0,limit-1))}…`}
export function safeSlackUrl(value?:string|null){try{const url=new URL(value??''); return ['http:','https:'].includes(url.protocol)?url.toString():undefined}catch{return undefined}}
