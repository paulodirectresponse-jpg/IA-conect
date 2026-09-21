import type{BetaCapability,BetaCapabilityMediaType,BetaCapabilityModel}from'../../../beta/capabilityClient.js';
import type{FlowNode}from'../../../beta/flowClient.js';
import type{SpaceAsset}from'../../../services/spacesClient.js';
import type{NodeOutputHistoryItem}from'../nodes/NodeResultPreview.js';

export const SPACE_NODE_SCHEMA_VERSION=2 as const;

const MEDIA_FALLBACK:Record<string,{inputs:BetaCapabilityMediaType[];outputs:BetaCapabilityMediaType[]}>={
 'text-to-image':{inputs:['TEXT'],outputs:['IMAGE']},
 'image-to-image':{inputs:['TEXT','IMAGE'],outputs:['IMAGE']},
 'image-edit':{inputs:['TEXT','IMAGE'],outputs:['IMAGE']},
 'background-remove-replace':{inputs:['IMAGE'],outputs:['IMAGE']},
 'upscale':{inputs:['IMAGE'],outputs:['IMAGE']},
 'outpaint':{inputs:['TEXT','IMAGE'],outputs:['IMAGE']},
 'variations':{inputs:['IMAGE'],outputs:['IMAGE']},
 'text-to-video':{inputs:['TEXT'],outputs:['VIDEO']},
 'image-to-video':{inputs:['TEXT','IMAGE'],outputs:['VIDEO']},
 'video-edit':{inputs:['TEXT','VIDEO'],outputs:['VIDEO']},
 'video-extend':{inputs:['VIDEO'],outputs:['VIDEO']},
};

export function spaceNodeOutputTypes(models:BetaCapabilityModel[],node:FlowNode):BetaCapabilityMediaType[]{
 if(node.kind==='ASSET'||node.kind==='INPUT')return node.media_type?[node.media_type]:[];
 if(node.kind==='TOOL'&&node.capability_id){
  for(const model of models){const cap=model.capabilities.find(c=>c.id===node.capability_id);if(cap)return cap.outputs;}
  return MEDIA_FALLBACK[node.capability_id]?.outputs||[];
 }
 return[];
}

export function spaceNodeInputTypes(models:BetaCapabilityModel[],node:FlowNode):BetaCapabilityMediaType[]{
 if(node.kind==='OUTPUT')return node.media_type?[node.media_type]:[];
 if(node.kind==='TOOL'&&node.capability_id){
  for(const model of models){const cap=model.capabilities.find(c=>c.id===node.capability_id);if(cap)return cap.inputs;}
  return MEDIA_FALLBACK[node.capability_id]?.inputs||[];
 }
 return[];
}

export function spaceNodeCapability(models:BetaCapabilityModel[],node:FlowNode):BetaCapability|null{
 if(node.kind!=='TOOL'||!node.capability_id)return null;
 const preferred=models.find(m=>m.model_id===node.model_id)?.capabilities.find(c=>c.id===node.capability_id);
 if(preferred)return preferred;
 return models.flatMap(m=>m.capabilities).find(c=>c.id===node.capability_id)||null;
}

export function normalizeSpaceNodeV2(node:FlowNode):FlowNode{
 return{
  ...node,
  schema_version:SPACE_NODE_SCHEMA_VERSION,
  ui:{
   fit:node.ui?.fit==='contain'?'contain':'cover',
   ...(Number.isFinite(Number(node.ui?.width))?{width:Number(node.ui?.width)}:{}),
   ...(Number.isFinite(Number(node.ui?.height))?{height:Number(node.ui?.height)}:{}),
  },
 };
}

export interface SpaceNodeMediaDescriptor{
 asset:SpaceAsset|null;
 source:'ASSET'|'GENERATED'|'NONE';
 mediaType:BetaCapabilityMediaType|null;
 width:number|null;
 height:number|null;
 durationSeconds:number|null;
 aspectRatio:number|null;
 previewUrl:string|null;
}

export function resolveSpaceNodeMedia(
 node:FlowNode,
 assetMap:Map<string,SpaceAsset>,
 history:NodeOutputHistoryItem[],
 historyIndex:number,
):SpaceNodeMediaDescriptor{
 let asset:SpaceAsset|null=null,source:SpaceNodeMediaDescriptor['source']='NONE';
 if(node.kind==='ASSET'&&node.asset_id){asset=assetMap.get(node.asset_id)||null;source=asset?'ASSET':'NONE';}
 if(node.kind==='TOOL'&&history.length){
  const safe=Math.max(0,Math.min(historyIndex,history.length-1));
  asset=history[safe]?.asset||null;
  source=asset?'GENERATED':'NONE';
 }
 const width=asset?.width??null,height=asset?.height??null;
 return{
  asset,
  source,
  mediaType:(asset?.type as BetaCapabilityMediaType|undefined)??node.media_type??null,
  width,
  height,
  durationSeconds:asset?.duration_seconds??null,
  aspectRatio:width&&height?width/height:null,
  previewUrl:asset?.preview_url||asset?.public_url||null,
 };
}
