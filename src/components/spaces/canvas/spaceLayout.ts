import type{FlowNode}from'../../../beta/flowClient.js';

export const SPACE_WORLD_W=8000;
export const SPACE_WORLD_H=5000;
export const SPACE_NODE_W=260;
export const SPACE_GENERATOR_NODE_W=286;
export const SPACE_BASE_NODE_H=156;

const GENERATOR_CAPABILITIES=new Set(['text-to-image','image-to-image','text-to-video','image-to-video']);
export function spaceNodeWidth(node:FlowNode){
 const adaptive=Number(node.ui?.width);
 if(Number.isFinite(adaptive)&&adaptive>=120&&adaptive<=1200)return adaptive;
 return node.kind==='TOOL'&&node.capability_id&&GENERATOR_CAPABILITIES.has(node.capability_id)?SPACE_GENERATOR_NODE_W:SPACE_NODE_W;
}

export function spaceNodeVisualHeight(node:FlowNode){
 const adaptive=Number(node.ui?.height);
 return Number.isFinite(adaptive)&&adaptive>=120&&adaptive<=1600?adaptive:null;
}

export function spaceConnectionPath(a:FlowNode,b:FlowNode,aH:number,bH:number){
 const x1=a.x+spaceNodeWidth(a),y1=a.y+aH/2,x2=b.x,y2=b.y+bH/2,c=Math.max(80,Math.abs(x2-x1)*.45);
 return`M ${x1} ${y1} C ${x1+c} ${y1}, ${x2-c} ${y2}, ${x2} ${y2}`;
}
