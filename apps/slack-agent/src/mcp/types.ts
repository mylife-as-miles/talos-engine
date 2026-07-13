export type TalosProject={id:string;name:string;domain?:string|null;environments:TalosEnvironment[];webUrl?:string};
export type TalosEnvironment={id:string;name:string;baseUrl?:string;isDefault?:boolean;authMode?:string};
export type TalosTest={id:string;name:string;intent:string;context?:string|null};
export type TalosRunStart={runId:string;status:string;webUrl:string;message?:string};
export type TalosRun={runId:string;status:string;summary?:string|null;startedAt?:string|null;completedAt?:string|null;stepsCount?:number;failedStepsCount?:number;steps?:Array<Record<string,unknown>>;bugs?:TalosBug[];webUrl?:string;displayName?:string|null};
export type TalosBug={id?:string;name:string;description:string;severity:'low'|'medium'|'high'|string;category?:string;url?:string|null;source?:string;screenshotUrl?:string;status?:string};
export class TalosMcpError extends Error{constructor(message:string, public detail?:unknown){super(message);this.name='TalosMcpError'}}
