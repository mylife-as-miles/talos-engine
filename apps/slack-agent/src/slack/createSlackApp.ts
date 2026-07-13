import { App } from '@slack/bolt';
import type { Config } from '../config.js';
export function createSlackApp(config:Config){return new App({token:config.SLACK_BOT_TOKEN,signingSecret:config.SLACK_SIGNING_SECRET,socketMode:config.SLACK_SOCKET_MODE,appToken:config.SLACK_APP_TOKEN,port:config.PORT})}
