import React from'react';
import type{BetaCapability,BetaCapabilityModel}from'../../../beta/capabilityClient.js';
import type{FlowNode}from'../../../beta/flowClient.js';
import type{FlowNodeRunView}from'../../../beta/flowRuntimeClient.js';
import{GeneratorNode}from'./GeneratorNode.js';
interface Props{node:FlowNode;capability:BetaCapability|null;models:BetaCapabilityModel[];nodeRun?:FlowNodeRunView;preview:React.ReactNode;busy:boolean;onPatch:(patch:Partial<FlowNode>)=>void;onGenerate:()=>void;}
export const ImageGeneratorNode:React.FC<Props>=props=><GeneratorNode {...props} mediaLabel="imagem"/>;
export default ImageGeneratorNode;