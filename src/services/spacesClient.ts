import {apiRequest} from './apiClient.js';
import type {BetaCapabilityModel,BetaCapabilityMediaType} from '../beta/capabilityClient.js';
import type {FlowRecord,FlowGraph} from '../beta/flowClient.js';
import type {FlowRunView,FlowBudgetQuoteView} from '../beta/flowRuntimeClient.js';
import type {UniversalAssetView} from '../beta/universalAssetClient.js';

function key(scope:string){const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;return `${scope}:${id}`;}

export type SpaceMediaType=BetaCapabilityMediaType;
export type SpaceAsset=UniversalAssetView;
export type SpaceRecord=FlowRecord;
export type SpaceRun=FlowRunView;
export type SpaceGraph=FlowGraph;

export const spacesClient={
 catalog:()=>apiRequest<{models:BetaCapabilityModel[]}>('/api/spaces/catalog'),
 assets:()=>apiRequest<UniversalAssetView[]>('/api/spaces/assets'),
 list:()=>apiRequest<FlowRecord[]>('/api/spaces/flows'),
 get:(flowId:string)=>apiRequest<FlowRecord>(`/api/spaces/flows/${encodeURIComponent(flowId)}`),
 create:(input:{name:string;description:string;project_id:string|null;graph:FlowGraph})=>apiRequest<FlowRecord>('/api/spaces/flows',{method:'POST',body:JSON.stringify(input)}),
 save:(flowId:string,input:{name:string;description:string;project_id:string|null;graph:FlowGraph;expected_revision:number})=>apiRequest<FlowRecord>(`/api/spaces/flows/${encodeURIComponent(flowId)}`,{method:'PUT',body:JSON.stringify(input)}),
 remove:(flowId:string)=>apiRequest<FlowRecord>(`/api/spaces/flows/${encodeURIComponent(flowId)}`,{method:'DELETE'}),
 quote:(flowId:string,maxCredits:number)=>apiRequest<FlowBudgetQuoteView>(`/api/spaces/flows/${encodeURIComponent(flowId)}/economics/quote`,{method:'POST',body:JSON.stringify({max_credits:maxCredits})}),
 start:(flowId:string,inputs:Record<string,any>,economics?:{flow_quote_id?:string;max_credits?:number})=>apiRequest<FlowRunView>(`/api/spaces/flows/${encodeURIComponent(flowId)}/runs`,{method:'POST',headers:{'Idempotency-Key':key('space-start')},body:JSON.stringify({inputs,...economics})}),
 getRun:(runId:string)=>apiRequest<FlowRunView>(`/api/spaces/runs/${encodeURIComponent(runId)}`),
 advance:(runId:string)=>apiRequest<FlowRunView>(`/api/spaces/runs/${encodeURIComponent(runId)}/advance`,{method:'POST'}),
 retry:(runId:string)=>apiRequest<FlowRunView>(`/api/spaces/runs/${encodeURIComponent(runId)}/retry`,{method:'POST'}),
 cancel:(runId:string)=>apiRequest<FlowRunView>(`/api/spaces/runs/${encodeURIComponent(runId)}/cancel`,{method:'POST'}),
};
