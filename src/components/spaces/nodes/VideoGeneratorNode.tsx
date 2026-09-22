import React from'react';
import type{BetaCapability,BetaCapabilityModel}from'../../../beta/capabilityClient.js';
import type{FlowNode}from'../../../beta/flowClient.js';
import type{FlowNodeRunView}from'../../../beta/flowRuntimeClient.js';
import type{NodeOutputHistoryItem}from'./NodeResultPreview.js';
import{GeneratorNode}from'./GeneratorNode.js';
interface Props{node:FlowNode;capability:BetaCapability|null;models:BetaCapabilityModel[];nodeRun?:FlowNodeRunView;history:NodeOutputHistoryItem[];historyIndex:number;busy:boolean;selected:boolean;onHistoryIndexChange:(index:number)=>void;onPatch:(patch:Partial<FlowNode>)=>void;onGenerate:()=>void;onAddAssetNode?:(asset:NodeOutputHistoryItem['asset'])=>void;}
export const VideoGeneratorNode:React.FC<Props>=props=><GeneratorNode {...props} mediaLabel="vídeo"/>;
export default VideoGeneratorNode;