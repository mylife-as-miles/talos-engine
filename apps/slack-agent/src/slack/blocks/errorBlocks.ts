type KnownBlock = Record<string, any>;
export function errorBlocks(message:string):KnownBlock[]{return[{type:'section',text:{type:'mrkdwn',text:`:warning: ${message}`}}]}
